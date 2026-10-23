"""LiveKit access tokens for video rooms."""

from datetime import timedelta
from uuid import uuid4

from django.conf import settings

from livekit.api import AccessToken, VideoGrants

# The inbox stays connected for as long as the page is open: a long-lived token
INBOX_TOKEN_TTL_SECONDS = 24 * 3600


class LiveKitNotConfigured(Exception):
    """Raised when the LiveKit server settings are missing."""


def is_configured():
    """Whether the settings needed to hand out LiveKit tokens are all set."""
    configuration = settings.LIVEKIT_CONFIGURATION
    return all(configuration.get(key) for key in ("api_key", "api_secret", "url"))


def get_room_name(document):
    """
    Name of the LiveKit room behind a document.

    LiveKit creates a room when the first participant connects and removes it when
    the last one leaves, so the document's id is all that has to persist.
    """
    return str(document.pk)


def get_participant_identity(user):
    """
    Stable identity of a user in LiveKit: the `sub` of their identity provider when
    they have one, as Visio does, so that a person opening two tabs is one participant.
    """
    return str(user.sub or user.pk or uuid4())


def get_participant_name(user):
    """Name shown to the other participants."""
    return user.full_name or user.short_name or str(user)


def generate_room_token(document, user, room_abilities):
    """
    Build the LiveKit connection details a user needs to enter a room.

    The rights inside the room follow `Document.get_room_abilities`:
    - everyone allowed to join can listen and watch;
    - those who can speak publish their audio, video and screen;
    - moderators get LiveKit's room admin rights (mute, remove).

    Args:
        document: the room, a `Document` of kind "room".
        user: an authenticated user.
        room_abilities: result of `document.get_room_abilities(user)`.

    Returns:
        dict: the LiveKit server `url`, the `room` name and the signed `token`.
    """
    if not is_configured():
        raise LiveKitNotConfigured("LiveKit is not configured.")

    configuration = settings.LIVEKIT_CONFIGURATION
    room_name = get_room_name(document)
    sources = list(settings.LIVEKIT_DEFAULT_SOURCES) if room_abilities["speak"] else []

    grants = VideoGrants(
        room=room_name,
        room_join=True,
        room_admin=room_abilities["moderate"],
        can_publish=bool(sources),
        can_publish_data=room_abilities["speak"],
        can_publish_sources=sources,
        can_subscribe=True,
        can_update_own_metadata=False,
    )

    token = (
        AccessToken(
            api_key=configuration["api_key"],
            api_secret=configuration["api_secret"],
        )
        .with_grants(grants)
        .with_identity(get_participant_identity(user))
        .with_name(get_participant_name(user))
        # Read back by the webhooks: they let us show who is in a room without
        # exposing the identity provider's `sub`, and spot a moderator whose
        # rights were removed since the token was signed.
        .with_attributes(
            {
                "user_id": str(user.pk),
                "moderator": "true" if room_abilities["moderate"] else "false",
            }
        )
        .with_ttl(timedelta(seconds=settings.LIVEKIT_TOKEN_TTL_SECONDS))
        .to_jwt()
    )

    return {"url": configuration["url"], "room": room_name, "token": token}


def get_inbox_room_name(user):
    """
    Name of the personal "inbox" room of a user: nobody else is ever in it.

    A person who is reachable stays connected to it, without sound or video, so that
    an invitation can be pushed to them at once, wherever they are in the application.
    The connection is also the proof that they are there: it ends with the browser.
    """
    return f"inbox-{user.pk}"


def generate_inbox_token(user):
    """Connection details to the personal inbox room: listen only."""
    if not is_configured():
        raise LiveKitNotConfigured("LiveKit is not configured.")

    configuration = settings.LIVEKIT_CONFIGURATION
    room_name = get_inbox_room_name(user)
    grants = VideoGrants(
        room=room_name,
        room_join=True,
        can_publish=False,
        can_publish_data=False,
        # nothing is ever published in an inbox, but the messages pushed to it
        # (the invitations) only reach those who may subscribe
        can_subscribe=True,
        can_update_own_metadata=False,
    )
    token = (
        AccessToken(
            api_key=configuration["api_key"],
            api_secret=configuration["api_secret"],
        )
        .with_grants(grants)
        # one identity per connection: a person with two tabs open has two
        .with_identity(f"inbox-{get_participant_identity(user)}-{uuid4().hex[:8]}")
        .with_name(get_participant_name(user))
        .with_attributes({"user_id": str(user.pk)})
        .with_ttl(timedelta(seconds=INBOX_TOKEN_TTL_SECONDS))
        .to_jwt()
    )
    return {"url": configuration["url"], "room": room_name, "token": token}
