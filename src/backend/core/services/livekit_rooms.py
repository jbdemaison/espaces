"""
Act on the people connected to a video room, after their rights changed.

A LiveKit token keeps working until it expires, whatever happens to the access that
earned it. When an access, a link or the place of a folder changes, this module checks
the people currently in the rooms concerned against what they can do now, and
- removes those who can no longer enter,
- removes the moderators who no longer moderate: they come back with a token without
  the moderator rights, as LiveKit cannot take them away from a live connection,
- adjusts the right to speak of the others.
"""

import logging

from django.apps import apps
from django.conf import settings

from asgiref.sync import async_to_sync
from livekit.api import (
    ListParticipantsRequest,
    LiveKitAPI,
    ParticipantPermission,
    RoomParticipantIdentity,
    TrackSource,
    TwirpError,
    UpdateParticipantRequest,
)

from core.services import livekit_tokens
from core.services.livekit_presence import PresenceStore

logger = logging.getLogger(__name__)


def _track_sources(names):
    """Settings name the sources in lowercase ("screen_share"); LiveKit wants its enum."""
    return [TrackSource.Value(name.upper()) for name in names]


def _permission(can_speak):
    """The rights of a participant who can (or cannot) publish."""
    sources = _track_sources(settings.LIVEKIT_DEFAULT_SOURCES) if can_speak else []
    return ParticipantPermission(
        can_subscribe=True,
        can_publish=can_speak,
        can_publish_data=can_speak,
        can_publish_sources=sources,
    )


def plan_changes(document, participants, users):
    """
    Decide what to do to each person in the room, without touching LiveKit.

    Args:
        document: the room.
        participants: the people in the room, as `PresenceStore.participants` gives them.
        users: the users of those people, by id (as text).

    Returns:
        (to_remove, to_update): identities to remove, and {identity: can_speak} for
        those who stay.
    """
    to_remove = []
    to_update = {}
    for person in participants:
        user = users.get(person.get("user_id"))
        abilities = (
            document.get_room_abilities(user)
            if user is not None
            else {"join": False, "speak": False, "moderate": False}
        )
        if not abilities["join"] or (
            person.get("moderator") and not abilities["moderate"]
        ):
            to_remove.append(person["identity"])
        else:
            to_update[person["identity"]] = abilities["speak"]
    return to_remove, to_update


@async_to_sync
async def _apply(room_name, to_remove, to_update):
    """Send the removals and the permission updates to LiveKit, over one session."""
    configuration = settings.LIVEKIT_CONFIGURATION
    lkapi = LiveKitAPI(
        url=configuration.get("internal_url") or configuration["url"],
        api_key=configuration["api_key"],
        api_secret=configuration["api_secret"],
    )
    failed = set()
    try:
        for identity in to_remove:
            try:
                await lkapi.room.remove_participant(
                    RoomParticipantIdentity(room=room_name, identity=identity)
                )
            except TwirpError as error:
                # Already gone: that is what we wanted
                if error.code != "not_found":
                    logger.exception(
                        "Could not remove %s from room %s", identity, room_name
                    )
                    failed.add(identity)
            except Exception:  # pylint: disable=broad-exception-caught
                logger.exception(
                    "Could not remove %s from room %s", identity, room_name
                )
                failed.add(identity)

        for identity, can_speak in to_update.items():
            try:
                await lkapi.room.update_participant(
                    UpdateParticipantRequest(
                        room=room_name,
                        identity=identity,
                        permission=_permission(can_speak),
                    )
                )
            except Exception:  # pylint: disable=broad-exception-caught
                logger.exception("Could not update %s in room %s", identity, room_name)
    finally:
        await lkapi.aclose()
    return failed


async def _list(room_names):
    configuration = settings.LIVEKIT_CONFIGURATION
    lkapi = LiveKitAPI(
        url=configuration.get("internal_url") or configuration["url"],
        api_key=configuration["api_key"],
        api_secret=configuration["api_secret"],
    )
    result = {}
    try:
        for room_name in room_names:
            answer = await lkapi.room.list_participants(
                ListParticipantsRequest(room=room_name)
            )
            result[room_name] = [
                {
                    "identity": person.identity,
                    "name": person.name,
                    "user_id": person.attributes.get("user_id"),
                }
                for person in answer.participants
            ]
    finally:
        await lkapi.aclose()
    return result


def live_participants(room_names):
    """
    Ask the LiveKit server who is in some rooms right now: {room name: people}.

    This is the truth, whereas the webhooks behind `PresenceStore` can be lost.
    Returns None when the server cannot be reached, so that callers can fall back.
    """
    room_names = list(room_names)
    if not room_names or not livekit_tokens.is_configured():
        return None
    try:
        return async_to_sync(_list)(room_names)
    except Exception:  # pylint: disable=broad-exception-caught
        logger.warning("Could not list the participants of LiveKit", exc_info=True)
        return None


def remove_from_room(room_name, identity):
    """Take one person out of a room, if they are still in it. Never raises."""
    if not livekit_tokens.is_configured():
        return
    try:
        _apply(room_name, [identity], {})
    except Exception:  # pylint: disable=broad-exception-caught
        logger.warning("Could not remove %s from %s", identity, room_name, exc_info=True)


def recheck_room(document, user_id=None):
    """
    Check the people in a room against their current rights.

    Args:
        document: the room.
        user_id: only check this user's connections; everybody when None.

    Returns:
        The identities that were removed from the room.
    """
    if not livekit_tokens.is_configured():
        return []

    room_name = livekit_tokens.get_room_name(document)
    store = PresenceStore()
    participants = store.participants(room_name)
    if user_id is not None:
        participants = [p for p in participants if p.get("user_id") == str(user_id)]
    if not participants:
        return []

    # resolved at run time: the models queue the tasks calling this module
    user_model = apps.get_model("core", "User")
    users = {
        str(user.pk): user
        for user in user_model.objects.filter(
            pk__in=[p["user_id"] for p in participants if p.get("user_id")]
        )
    }
    to_remove, to_update = plan_changes(document, participants, users)
    failed = _apply(room_name, to_remove, to_update)

    removed = [identity for identity in to_remove if identity not in failed]
    sessions = {p["identity"]: p.get("sid") for p in participants}
    for identity in removed:
        # LiveKit also reports it with a webhook; this makes the list right now
        store.leave(room_name, identity, sessions[identity])
    return removed
