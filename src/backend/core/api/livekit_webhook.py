"""Endpoint receiving the webhooks of the LiveKit server."""

from rest_framework import response, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from core.services import livekit_tokens
from core.services.livekit_events import LiveKitEventsService, LiveKitWebhookError
from core.services.livekit_presence import (
    SITUATION_EMOJI_MAX_LENGTH,
    SITUATION_TEXT_MAX_LENGTH,
    PresenceStore,
)


class LiveKitWebhookView(APIView):
    """
    Receive the events of the LiveKit server, to know who is in each video room.

    LiveKit signs every call with the key and secret it shares with us, so the
    request carries no session: the signature is the authentication.
    """

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = []

    def post(self, request, *args, **kwargs):
        """Check the signature of the event and apply it."""
        if not livekit_tokens.is_configured():
            return response.Response(
                {"detail": "Video rooms are not available on this instance."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # The raw body is what is signed: it must be read before anything parses it.
        body = request.body.decode("utf-8", errors="replace")

        try:
            LiveKitEventsService().receive(body, request.headers.get("Authorization"))
        except LiveKitWebhookError as error:
            return response.Response({"detail": str(error)}, status=error.status_code)

        return response.Response(status=status.HTTP_200_OK)


class UserStatusView(APIView):
    """
    What a person says about themselves: their situation (an emoji and a short text,
    seen by the people of the spaces they are in) and whether they are reachable
    (others may invite them to join a room), whatever the situation.
    """

    permission_classes = [IsAuthenticated]

    @staticmethod
    def _answer(user_id):
        store = PresenceStore()
        situation = store.situations([user_id]).get(str(user_id), {})
        return {
            "emoji": situation.get("emoji", ""),
            "text": situation.get("text", ""),
            "reachable": str(user_id) in store.reachable([user_id]),
        }

    def get(self, request, *args, **kwargs):
        """Give the situation and the reachability of the current user."""
        # opening the page keeps the situation alive
        PresenceStore().touch_situation(request.user.pk)
        return response.Response(self._answer(request.user.pk))

    def put(self, request, *args, **kwargs):
        """Change the situation and/or the reachability of the current user."""
        data = request.data
        store = PresenceStore()
        errors = {}

        if "reachable" in data and not isinstance(data["reachable"], bool):
            errors["reachable"] = ["Must be true or false."]

        has_situation = "emoji" in data or "text" in data
        emoji = data.get("emoji", "")
        text = data.get("text", "")
        if has_situation:
            if not isinstance(emoji, str) or not isinstance(text, str):
                errors["text"] = ["Must be a string."]
            else:
                emoji, text = emoji.strip(), text.strip()
                if len(emoji) > SITUATION_EMOJI_MAX_LENGTH:
                    errors["emoji"] = ["Too long."]
                if len(text) > SITUATION_TEXT_MAX_LENGTH:
                    errors["text"] = [
                        f"At most {SITUATION_TEXT_MAX_LENGTH} characters."
                    ]
                elif any(char in text for char in "\n\r\t"):
                    errors["text"] = ["Must fit on one line."]
        if errors:
            return response.Response(errors, status=status.HTTP_400_BAD_REQUEST)

        if has_situation:
            store.set_situation(request.user.pk, emoji, text)
        if "reachable" in data:
            store.set_reachable(request.user.pk, data["reachable"])
        return response.Response(self._answer(request.user.pk))


class UserInboxView(APIView):
    """
    The details to connect to one's personal inbox room, kept open while "reachable".

    The connection tells the others that the person is there, and carries the
    invitations they are sent.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        """Give the connection details of the inbox of the current user."""
        try:
            details = livekit_tokens.generate_inbox_token(request.user)
        except livekit_tokens.LiveKitNotConfigured:
            return response.Response(
                {"detail": "Video rooms are not available on this instance."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return response.Response({"livekit": details})


class UserInboxReadyView(APIView):
    """
    The page of a reachable person says, every few seconds, that its connection to
    the inbox is complete: only then can it receive an invitation.
    """

    permission_classes = [IsAuthenticated]
    throttle_scope = "presence"

    def post(self, request, *args, **kwargs):
        """Remember that the inbox of the current user works."""
        PresenceStore().mark_inbox_ready(request.user.pk)
        return response.Response(status=status.HTTP_204_NO_CONTENT)
