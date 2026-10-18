"""Handle the webhooks sent by the LiveKit server."""

import logging
import uuid

from django.conf import settings

from livekit.api import TokenVerifier, WebhookReceiver

from core.services.livekit_presence import PresenceStore

logger = logging.getLogger(__name__)


class LiveKitWebhookError(Exception):
    """Base exception for the webhooks LiveKit sends us."""

    status_code = 500


class AuthenticationError(LiveKitWebhookError):
    """The request is not signed by our LiveKit server."""

    status_code = 401


class InvalidPayloadError(LiveKitWebhookError):
    """The request cannot be read as a LiveKit event."""

    status_code = 400


def is_room_name(name):
    """Rooms are named after the id of their document: anything else is not ours."""
    try:
        uuid.UUID(name)
    except ValueError, TypeError, AttributeError:
        return False
    return True


class LiveKitEventsService:
    """Check the signature of a webhook and keep the presence of the rooms up to date."""

    def __init__(self):
        configuration = settings.LIVEKIT_CONFIGURATION
        self.receiver = WebhookReceiver(
            TokenVerifier(configuration["api_key"], configuration["api_secret"])
        )
        self.presence = PresenceStore()
        self.handlers = {
            "participant_joined": self._handle_participant_joined,
            "participant_left": self._handle_participant_left,
            "participant_connection_aborted": self._handle_participant_left,
            "room_finished": self._handle_room_finished,
        }

    def receive(self, body, auth_token):
        """
        Verify a webhook and apply it.

        Args:
            body: the raw request body, as text: the signature covers it byte for byte.
            auth_token: the value of the Authorization header.
        """
        if not auth_token:
            raise AuthenticationError("Authorization header missing")

        try:
            event = self.receiver.receive(body, auth_token)
        except Exception as error:  # pylint: disable=broad-exception-caught
            # The library raises for a wrong signature as well as for a body that
            # does not match it or is not an event: all of them are refused.
            raise InvalidPayloadError("Invalid webhook payload") from error

        handler = self.handlers.get(event.event)
        if handler is None or not is_room_name(event.room.name):
            return

        handler(event)

    def _handle_participant_joined(self, event):
        participant = event.participant
        self.presence.join(
            event.room.name,
            participant.identity,
            participant.sid,
            participant.name,
            user_id=participant.attributes.get("user_id"),
            moderator=participant.attributes.get("moderator") == "true",
        )

    def _handle_participant_left(self, event):
        self.presence.leave(
            event.room.name, event.participant.identity, event.participant.sid
        )

    def _handle_room_finished(self, event):
        self.presence.clear_room(event.room.name)
