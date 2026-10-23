"""Invitations to join a video room, sent to the people who are "reachable"."""

import uuid

from rest_framework import response, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core import choices, models
from core.api.viewsets import DocumentViewSet
from core.services import livekit_invitations, livekit_rooms, livekit_tokens


def _uuid(value, field):
    try:
        return uuid.UUID(str(value))
    except ValueError as error:
        raise ValidationError({field: "Must be a valid id."}) from error


MESSAGE_MAX_LENGTH = 140


def _message(value):
    """
    The reason given with an invitation: plain text on one line, 140 characters at most.
    Control characters and line breaks are turned into spaces.
    """
    if value in (None, ""):
        return ""
    if not isinstance(value, str):
        raise ValidationError({"message": "Must be a text."})
    text = " ".join("".join(c if c.isprintable() else " " for c in value).split())
    if len(text) > MESSAGE_MAX_LENGTH:
        raise ValidationError(
            {"message": f"At most {MESSAGE_MAX_LENGTH:d} characters."}
        )
    return text


def _refusal(code, http_status):
    return response.Response({"code": code}, status=http_status)


class InvitationsView(APIView):
    """Invite somebody, who is reachable from a space, to join one of its sub-spaces."""

    permission_classes = [IsAuthenticated]
    throttle_scope = "room_invitation"

    def post(self, request, *args, **kwargs):  # noqa: PLR0911
        """
        Send an invitation to join a room to a person reachable there.

        Answers 201 with the invitation, or 409 with a `code` saying why not:
        `not_reachable` (they are not, or no longer, reachable from the space of this room),
        `already_there` (they are in this room already),
        `busy` (too many invitations are already waiting for them) or `unreachable`
        (the invitation could not be delivered).
        """
        room_id = _uuid(request.data.get("room_id"), "room_id")
        target_id = _uuid(request.data.get("user_id"), "user_id")
        message = _message(request.data.get("message"))

        room = (
            models.Document.objects.filter(
                pk=room_id,
                kind=choices.DocumentKindChoices.ROOM,
                ancestors_deleted_at__isnull=True,
            )
            .annotate_user_roles(request.user)
            .annotate_user_has_link_trace(request.user)
            .first()
        )
        if room is None or not room.get_room_abilities(request.user)["join"]:
            raise PermissionDenied()

        target = models.User.objects.filter(pk=target_id).first()
        step = models.Document.steplen
        space = models.Document.objects.filter(
            path=room.path[:-step], kind=choices.DocumentKindChoices.FOLDER
        ).first()
        if (
            target is None
            or target.pk == request.user.pk
            or space is None
            or not space.get_abilities(request.user)["retrieve"]
        ):
            return _refusal("not_reachable", status.HTTP_409_CONFLICT)

        # Reachable from the space of the room, even when in another of its rooms
        reachable = DocumentViewSet.reachable_people([space]).get(str(space.pk), [])
        if not any(item["user_id"] == str(target.pk) for item in reachable):
            return _refusal("not_reachable", status.HTTP_409_CONFLICT)

        # no point in inviting somebody to the room they are in
        in_room = DocumentViewSet.participants_in(
            [livekit_tokens.get_room_name(room)]
        ).get(livekit_tokens.get_room_name(room), [])
        if any(str(person.get("user_id")) == str(target.pk) for person in in_room):
            return _refusal("already_there", status.HTTP_409_CONFLICT)

        # the invited person must be allowed into the room itself, not only the space
        target_room = (
            models.Document.objects.filter(pk=room.pk)
            .annotate_user_roles(target)
            .annotate_user_has_link_trace(target)
            .first()
        )
        if target_room is None or not target_room.get_room_abilities(target)["join"]:
            return _refusal("not_reachable", status.HTTP_409_CONFLICT)

        try:
            invitation = livekit_invitations.create(
                to_user_id=target.pk,
                from_user_id=str(request.user.pk),
                from_name=livekit_tokens.get_participant_name(request.user),
                room_id=str(room.pk),
                message=message,
            )
        except livekit_invitations.TooManyInvitations:
            return _refusal("busy", status.HTTP_409_CONFLICT)

        delivered = livekit_rooms.send_to_inbox(
            target,
            {
                "type": "invitation",
                "id": invitation["id"],
                "expires_at": invitation["expires_at"],
                "from": {
                    "user_id": invitation["from_user_id"],
                    "name": invitation["from_name"],
                },
                "message": message,
                "room": {
                    "id": str(room.pk),
                    "title": room.title or "",
                    "emoji": room.emoji,
                },
                "space": {
                    "id": str(space.pk) if space else None,
                    "title": (space.title or "") if space else "",
                    "emoji": space.emoji if space else "",
                },
            },
        )
        if not delivered:
            livekit_invitations.discard(invitation["id"])
            return _refusal("unreachable", status.HTTP_409_CONFLICT)

        return response.Response(
            {"id": invitation["id"], "expires_at": invitation["expires_at"]},
            status=status.HTTP_201_CREATED,
        )


class InvitationView(APIView):
    """What became of an invitation, for the person who sent it."""

    permission_classes = [IsAuthenticated]

    def get(self, request, invitation_id, *args, **kwargs):
        """
        `pending`, `accepted`, `unavailable` or `expired`.

        Somebody who ignored the invitation did not answer: it stays `pending` until
        it expires.
        """
        invitation = livekit_invitations.get(invitation_id)
        if invitation is None or invitation["from_user_id"] != str(request.user.pk):
            return response.Response(status=status.HTTP_404_NOT_FOUND)
        state = invitation["status"]
        return response.Response({"status": "pending" if state == "ignored" else state})


class InvitationAnswerView(APIView):
    """The person invited answers: join, say they are unavailable, or ignore it."""

    permission_classes = [IsAuthenticated]

    def post(self, request, invitation_id, *args, **kwargs):
        """Record the `answer`: `accept`, `unavailable` or `ignore`."""
        choice = request.data.get("answer")
        if choice not in livekit_invitations.ANSWERS:
            raise ValidationError(
                {"answer": f"Must be one of: {', '.join(livekit_invitations.ANSWERS)}."}
            )
        invitation = livekit_invitations.answer(invitation_id, request.user.pk, choice)
        if invitation is None:
            return response.Response(status=status.HTTP_404_NOT_FOUND)
        return response.Response(
            {"status": invitation["status"], "room_id": invitation["room_id"]}
        )
