"""Endpoint receiving the webhooks of the LiveKit server."""

from rest_framework import response, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from core.services import livekit_tokens
from core.services.livekit_events import LiveKitEventsService, LiveKitWebhookError
from core.services.livekit_presence import STATUSES, PresenceStore


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
    """The status a person chose (available, busy, away), shown on their round of initials."""

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        """Give the status of the current user."""
        status_by_user = PresenceStore().statuses([request.user.pk])
        return response.Response({"status": status_by_user[str(request.user.pk)]})

    def put(self, request, *args, **kwargs):
        """Change the status of the current user."""
        new_status = request.data.get("status")
        if new_status not in STATUSES:
            return response.Response(
                {"status": [f"Must be one of: {', '.join(STATUSES)}."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        PresenceStore().set_status(request.user.pk, new_status)
        return response.Response({"status": new_status})
