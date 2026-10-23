"""The sounds of a space: short clips that anybody in a video room can play for everyone."""

import io
import wave

from django.http import HttpResponse

import magic
from rest_framework import response, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core import choices, models

SOUND_MAX_BYTES = 300 * 1024
SOUND_MAX_PER_SPACE = 20
SOUND_MAX_SECONDS = 5
# The browser cuts the part to keep out of the file the person chose and sends it
# as WAV: that is the only format kept, so that its length can be checked here too
SOUND_TYPES = {"audio/wav": "audio/wav", "audio/x-wav": "audio/wav"}
# a little room over the 5 seconds for rounding
SOUND_MAX_SECONDS_TOLERATED = SOUND_MAX_SECONDS + 0.1
# what the browser may start from, before keeping 5 seconds of it
SOUND_SOURCE_MAX_SECONDS = 20
DEFAULT_EMOJI = "🔊"


def _space_of(user, document_id):
    """
    The space a document belongs to, for a space or for one of its rooms, with
    the abilities of the user on it. Anything else is "not found", as is a space
    the user cannot see: asking never tells whether it exists.
    """
    try:
        document = models.Document.objects.filter(
            pk=document_id, ancestors_deleted_at__isnull=True, deleted_at__isnull=True
        ).first()
    except ValueError, TypeError:
        document = None
    if document is None:
        raise NotFound()

    if document.kind == choices.DocumentKindChoices.ROOM:
        space_path = document.path[: -models.Document.steplen]
    elif document.kind == choices.DocumentKindChoices.FOLDER:
        space_path = document.path
    else:
        raise NotFound()

    space = (
        models.Document.objects.filter(
            path=space_path, kind=choices.DocumentKindChoices.FOLDER
        )
        .annotate_user_roles(user)
        .annotate_user_has_link_trace(user)
        .first()
    )
    if space is None:
        raise NotFound()
    abilities = space.get_abilities(user)
    if not abilities["retrieve"]:
        raise NotFound()
    return space, abilities


def _describe(sound, user, can_manage):
    return {
        "id": str(sound.id),
        "name": sound.name,
        "emoji": sound.emoji,
        "version": int(sound.updated_at.timestamp()),
        "can_delete": can_manage or sound.created_by_id == user.pk,
    }


class SpaceSoundsView(APIView):
    """List the sounds of a space, or add one."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]
    throttle_scope = "sound"

    def get(self, request, document_id):
        """The sounds of the space of a space or of one of its rooms."""
        space, abilities = _space_of(request.user, document_id)
        can_manage = abilities["partial_update"]
        sounds = models.SpaceSound.objects.filter(space=space).only(
            "id", "name", "emoji", "updated_at", "created_by_id"
        )
        return response.Response(
            {
                "results": [_describe(s, request.user, can_manage) for s in sounds],
                "can_add": bool(can_manage),
                "max_bytes": SOUND_MAX_BYTES,
                "max_seconds": SOUND_MAX_SECONDS,
                "max_source_seconds": SOUND_SOURCE_MAX_SECONDS,
                "max_count": SOUND_MAX_PER_SPACE,
            }
        )

    def post(self, request, document_id):
        """Add a sound (file in `file`, with a `name` and an optional `emoji`)."""
        space, abilities = _space_of(request.user, document_id)
        if not abilities["partial_update"]:
            return response.Response(status=status.HTTP_403_FORBIDDEN)

        name = str(request.data.get("name", "")).strip()
        if not 1 <= len(name) <= 40:
            raise ValidationError({"name": "The name must have 1 to 40 characters."})
        emoji = str(request.data.get("emoji", "")).strip() or DEFAULT_EMOJI
        if len(emoji) > 16:
            raise ValidationError({"emoji": "The emoji is too long."})

        upload = request.FILES.get("file")
        if upload is None:
            raise ValidationError({"file": "No sound was sent."})
        if upload.size > SOUND_MAX_BYTES:
            raise ValidationError({"file": "The sound is too big."})
        data = upload.read()
        detected = magic.from_buffer(data[:4096], mime=True)
        if detected not in SOUND_TYPES:
            raise ValidationError({"file": "The sound must be a WAV file."})
        try:
            with wave.open(io.BytesIO(data)) as clip:
                seconds = clip.getnframes() / clip.getframerate()
        except (wave.Error, EOFError, ZeroDivisionError) as error:
            raise ValidationError({"file": "The sound cannot be read."}) from error
        if not 0 < seconds <= SOUND_MAX_SECONDS_TOLERATED:
            raise ValidationError(
                {"file": f"The sound must last {SOUND_MAX_SECONDS:d} seconds at most."}
            )

        if models.SpaceSound.objects.filter(space=space).count() >= SOUND_MAX_PER_SPACE:
            raise ValidationError({"file": "This space has too many sounds."})

        sound = models.SpaceSound.objects.create(
            space=space,
            name=name,
            emoji=emoji,
            content_type=SOUND_TYPES[detected],
            data=data,
            created_by=request.user,
        )
        return response.Response(
            _describe(sound, request.user, True), status=status.HTTP_201_CREATED
        )


class SpaceSoundView(APIView):
    """Read (to play it) or remove a sound of a space."""

    permission_classes = [IsAuthenticated]
    throttle_scope = "sound_read"

    def get(self, request, document_id, sound_id):
        """The audio of the sound, for the people who can see its space."""
        space, _ = _space_of(request.user, document_id)
        sound = models.SpaceSound.objects.filter(space=space, pk=sound_id).first()
        if sound is None:
            raise NotFound()
        reply = HttpResponse(bytes(sound.data), content_type=sound.content_type)
        reply["Cache-Control"] = "private, max-age=86400"
        reply["X-Content-Type-Options"] = "nosniff"
        reply["Content-Security-Policy"] = "default-src 'none'; sandbox"
        return reply

    def delete(self, request, document_id, sound_id):
        """Remove a sound: who manages the space, or who added it."""
        space, abilities = _space_of(request.user, document_id)
        sound = models.SpaceSound.objects.filter(space=space, pk=sound_id).first()
        if sound is None:
            raise NotFound()
        if not (abilities["partial_update"] or sound.created_by_id == request.user.pk):
            return response.Response(status=status.HTTP_403_FORBIDDEN)
        sound.delete()
        return response.Response(status=status.HTTP_204_NO_CONTENT)
