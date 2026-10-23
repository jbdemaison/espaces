"""Being listed by LiveKit in an inbox is not enough: the page must confirm it receives."""

from unittest import mock

from django.test import override_settings

import pytest
from rest_framework.test import APIClient

from core import factories
from core.services import livekit_rooms
from core.services.livekit_presence import INBOX_READY_PREFIX, PresenceStore

pytestmark = pytest.mark.django_db

LIVEKIT_CONFIGURATION = {
    "api_key": "devkey-padded-for-minimum-len!-livekit",
    "api_secret": "secret-key-padded-for-minimum-len!-livekit",
    "url": "http://127.0.0.1.nip.io:7880",
}


@pytest.fixture(autouse=True)
def clean_redis():
    """Keys live in Redis, outside of the test transaction."""
    redis = PresenceStore._redis()  # pylint: disable=protected-access
    for key in redis.scan_iter(f"{INBOX_READY_PREFIX}:*"):
        redis.delete(key)
    yield
    for key in redis.scan_iter(f"{INBOX_READY_PREFIX}:*"):
        redis.delete(key)


def test_inbox_ready_endpoint_needs_login():
    """Anonymous visitors cannot say they are ready."""
    response = APIClient().post("/api/v1.0/user-inbox/ready/")
    assert response.status_code == 401


def test_inbox_ready_endpoint_marks_the_user():
    """The page says its inbox works: the user is remembered as ready."""
    user = factories.UserFactory()
    other = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    assert client.post("/api/v1.0/user-inbox/ready/").status_code == 204

    ready = PresenceStore().inbox_ready([user.pk, other.pk])
    assert ready == {str(user.pk)}


@override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION)
def test_online_inboxes_needs_both_livekit_and_the_confirmation():
    """Listed without confirmation (connection never completed) is not online."""
    listed_and_ready = factories.UserFactory()
    listed_only = factories.UserFactory()
    ready_only = factories.UserFactory()
    PresenceStore().mark_inbox_ready(listed_and_ready.pk)
    PresenceStore().mark_inbox_ready(ready_only.pk)
    users = [listed_and_ready, listed_only, ready_only]

    with mock.patch.object(
        livekit_rooms,
        "_online_inboxes",
        new=mock.AsyncMock(
            return_value={str(listed_and_ready.pk), str(listed_only.pk)}
        ),
    ):
        online = livekit_rooms.online_inboxes(users)

    assert online == {str(listed_and_ready.pk)}


@override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION)
def test_online_inboxes_is_none_when_livekit_cannot_be_asked():
    """No answer from LiveKit: nobody can be said to be online."""
    user = factories.UserFactory()
    with mock.patch.object(
        livekit_rooms, "_online_inboxes", new=mock.AsyncMock(side_effect=OSError)
    ):
        assert livekit_rooms.online_inboxes([user]) is None
