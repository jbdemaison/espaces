"""
Tests for the presence in video rooms: the LiveKit webhook that feeds it, and the
endpoints listing who is in a room.
"""

import base64
import hashlib
import json
import uuid
from unittest import mock

from django.test import override_settings

import pytest
from livekit.api import AccessToken, TokenVerifier
from rest_framework.test import APIClient

from core import factories
from core.choices import DocumentKindChoices
from core.services import livekit_rooms
from core.services.livekit_presence import (
    CURRENT_ROOM_PREFIX,
    KEY_PREFIX,
    STATUS_PREFIX,
    PresenceStore,
)

pytestmark = pytest.mark.django_db

LIVEKIT_CONFIGURATION = {
    "api_key": "devkey-padded-for-minimum-len!-livekit",
    "api_secret": "secret-key-padded-for-minimum-len!-livekit",
    "url": "http://127.0.0.1.nip.io:7880",
}
WEBHOOK_URL = "/api/v1.0/livekit/webhook/"


@pytest.fixture(autouse=True)
def no_live_livekit():
    """By default LiveKit cannot be asked: the webhooks' record is what is shown."""
    with mock.patch.object(livekit_rooms, "live_participants", return_value=None):
        yield


@pytest.fixture(autouse=True)
def clean_presence():
    """Presence lives in Redis, outside of the test transaction: empty it around tests."""
    redis = PresenceStore._redis()  # pylint: disable=protected-access
    prefixes = (KEY_PREFIX, STATUS_PREFIX, CURRENT_ROOM_PREFIX)
    for prefix in prefixes:
        for key in redis.scan_iter(f"{prefix}:*"):
            redis.delete(key)
    yield
    for prefix in prefixes:
        for key in redis.scan_iter(f"{prefix}:*"):
            redis.delete(key)


def signed(event, secret=LIVEKIT_CONFIGURATION["api_secret"]):
    """Body and Authorization header of an event, signed the way LiveKit does."""
    body = json.dumps(event)
    digest = base64.b64encode(hashlib.sha256(body.encode()).digest()).decode()
    token = (
        AccessToken(LIVEKIT_CONFIGURATION["api_key"], secret)
        .with_sha256(digest)
        .to_jwt()
    )
    return body, token


def send(event, **kwargs):
    """Post an event to the webhook, as LiveKit would."""
    body, token = signed(event, **kwargs)
    return APIClient().post(
        WEBHOOK_URL,
        data=body,
        content_type="application/webhook+json",
        headers={"Authorization": token},
    )


def joined(room, identity="sub-ana", sid="PA_1", name="Ana", user_id="u1", **extra):
    """A participant_joined event."""
    return {
        "event": "participant_joined",
        "room": {"name": str(room.id) if hasattr(room, "id") else room},
        "participant": {
            "sid": sid,
            "identity": identity,
            "name": name,
            "attributes": {"user_id": user_id, "moderator": "false", **extra},
        },
    }


def left(room, identity="sub-ana", sid="PA_1", event="participant_left"):
    """A participant_left event."""
    return {
        "event": event,
        "room": {"name": str(room.id)},
        "participant": {"sid": sid, "identity": identity},
    }


def make_room(parent=None, **kwargs):
    """Create a restricted room, optionally inside a folder."""
    kwargs.setdefault("link_reach", "restricted")
    return factories.DocumentFactory(
        kind=DocumentKindChoices.ROOM, parent=parent, **kwargs
    )


def make_folder(**kwargs):
    """Create a restricted folder."""
    kwargs.setdefault("link_reach", "restricted")
    return factories.DocumentFactory(kind=DocumentKindChoices.FOLDER, **kwargs)


# Webhook


@override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION)
def test_api_livekit_webhook_requires_a_signature():
    """A request without the Authorization header is refused."""
    response = APIClient().post(
        WEBHOOK_URL, data="{}", content_type="application/webhook+json"
    )

    assert response.status_code == 401


@override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION)
def test_api_livekit_webhook_refuses_a_wrong_secret():
    """An event signed with another secret is refused and changes nothing."""
    room = make_room()

    response = send(joined(room), secret="another-secret-padded-for-minimum-len!!")

    assert response.status_code == 400
    assert PresenceStore().participants(str(room.id)) == []


@override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION)
def test_api_livekit_webhook_refuses_a_modified_body():
    """The signature covers the body: a body changed after signing is refused."""
    room = make_room()
    body, token = signed(joined(room, name="Ana"))

    response = APIClient().post(
        WEBHOOK_URL,
        data=body.replace("Ana", "Bob"),
        content_type="application/webhook+json",
        headers={"Authorization": token},
    )

    assert response.status_code == 400
    assert PresenceStore().participants(str(room.id)) == []


@override_settings(
    LIVEKIT_CONFIGURATION={"api_key": None, "api_secret": None, "url": None}
)
def test_api_livekit_webhook_livekit_not_configured():
    """Without a LiveKit server, the endpoint says rooms are unavailable."""
    response = APIClient().post(
        WEBHOOK_URL,
        data="{}",
        content_type="application/webhook+json",
        headers={"Authorization": "whatever"},
    )

    assert response.status_code == 503


@override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION)
def test_api_livekit_webhook_join_then_leave():
    """Someone who joins is listed, and removed when they leave."""
    room = make_room()

    assert send(joined(room)).status_code == 200
    assert [p["name"] for p in PresenceStore().participants(str(room.id))] == ["Ana"]

    assert send(left(room)).status_code == 200
    assert PresenceStore().participants(str(room.id)) == []


@override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION)
def test_api_livekit_webhook_connection_aborted_removes_the_person():
    """A connection that dropped counts as a departure."""
    room = make_room()
    send(joined(room))

    send(left(room, event="participant_connection_aborted"))

    assert PresenceStore().participants(str(room.id)) == []


@override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION)
def test_api_livekit_webhook_old_session_leaving_does_not_remove_the_new_one():
    """
    A person who reconnects is one participant: LiveKit may report the departure of the
    old session after the arrival of the new one, which must not remove them.
    """
    room = make_room()
    send(joined(room, sid="PA_old"))
    send(joined(room, sid="PA_new"))

    send(left(room, sid="PA_old"))

    assert [p["sid"] for p in PresenceStore().participants(str(room.id))] == ["PA_new"]


@override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION)
def test_api_livekit_webhook_room_finished_clears_everybody():
    """When LiveKit closes the room, nobody is left in the list."""
    room = make_room()
    send(joined(room, identity="a", name="Ana"))
    send(joined(room, identity="b", name="Bob", sid="PA_2"))

    response = send({"event": "room_finished", "room": {"name": str(room.id)}})

    assert response.status_code == 200
    assert PresenceStore().participants(str(room.id)) == []


@override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION)
def test_api_livekit_webhook_ignores_rooms_that_are_not_ours():
    """Only rooms named after a document id are tracked."""
    response = send(joined("some-other-room"))

    assert response.status_code == 200
    assert PresenceStore().participants("some-other-room") == []


@override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION)
def test_api_livekit_webhook_ignores_other_events():
    """Events about tracks or recordings are acknowledged and ignored."""
    room = make_room()

    response = send({"event": "track_published", "room": {"name": str(room.id)}})

    assert response.status_code == 200
    assert PresenceStore().participants(str(room.id)) == []


@override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION)
def test_api_livekit_webhook_presence_expires():
    """The list kept for a room has a lifetime, renewed by every arrival."""
    room = make_room()
    send(joined(room))

    ttl = PresenceStore._redis().ttl(f"{KEY_PREFIX}:{room.id}")  # pylint: disable=protected-access

    assert 0 < ttl <= 86400


# Token


@override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION)
@pytest.mark.parametrize(
    "role,moderator", [["reader", "false"], ["editor", "false"], ["owner", "true"]]
)
def test_api_documents_room_access_token_carries_presence_attributes(role, moderator):
    """The token tells the webhooks who the person is, without their identity provider id."""
    user = factories.UserFactory()
    room = make_room(users=[(user, role)])
    client = APIClient()
    client.force_login(user)

    response = client.post(f"/api/v1.0/documents/{room.id!s}/room-access/")

    claims = TokenVerifier(
        LIVEKIT_CONFIGURATION["api_key"], LIVEKIT_CONFIGURATION["api_secret"]
    ).verify(response.json()["livekit"]["token"])
    assert claims.attributes == {"user_id": str(user.pk), "moderator": moderator}


# Reading the presence


def test_api_documents_room_presence_anonymous():
    """Anonymous users cannot see who is in a room."""
    room = make_room(link_reach="public")

    response = APIClient().get(f"/api/v1.0/documents/{room.id!s}/room-presence/")

    assert response.status_code == 401


def test_api_documents_room_presence_lists_names_not_identities():
    """Someone allowed in the room sees the names and user ids, nothing more."""
    user = factories.UserFactory()
    room = make_room(users=[(user, "reader")])
    store = PresenceStore()
    store.join(str(room.id), "sub-bob", "PA_2", "Bob", user_id="u2")
    store.join(str(room.id), "sub-ana", "PA_1", "Ana", user_id="u1", moderator=True)
    client = APIClient()
    client.force_login(user)

    response = client.get(f"/api/v1.0/documents/{room.id!s}/room-presence/")

    assert response.status_code == 200
    assert response.json() == {
        "participants": [
            {"user_id": "u1", "name": "Ana", "status": "available"},
            {"user_id": "u2", "name": "Bob", "status": "available"},
        ]
    }


def test_api_documents_room_presence_forbidden_without_access():
    """Nobody learns who is in a room they cannot enter."""
    user = factories.UserFactory()
    room = make_room()
    PresenceStore().join(str(room.id), "sub-ana", "PA_1", "Ana", user_id="u1")
    client = APIClient()
    client.force_login(user)

    response = client.get(f"/api/v1.0/documents/{room.id!s}/room-presence/")

    assert response.status_code == 403
    assert "Ana" not in response.content.decode()


def test_api_documents_room_presence_not_a_room():
    """A regular document has no presence."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, "owner")])
    client = APIClient()
    client.force_login(user)

    response = client.get(f"/api/v1.0/documents/{document.id!s}/room-presence/")

    assert response.status_code == 403


def test_api_documents_rooms_presence_gives_each_visible_room():
    """The left panel gets the people of every room it asks about, in one call."""
    user = factories.UserFactory()
    folder = make_folder(users=[(user, "reader")])
    lounge = make_room(parent=folder)
    standup = make_room(parent=folder)
    store = PresenceStore()
    store.join(str(lounge.id), "sub-ana", "PA_1", "Ana", user_id="u1")
    client = APIClient()
    client.force_login(user)

    response = client.get(
        f"/api/v1.0/documents/rooms-presence/?ids={lounge.id!s},{standup.id!s}"
    )

    assert response.status_code == 200
    assert response.json() == {
        "rooms": {
            str(lounge.id): [{"user_id": "u1", "name": "Ana", "status": "available"}],
            str(standup.id): [],
        }
    }


def test_api_documents_rooms_presence_leaves_out_what_the_user_cannot_enter():
    """Rooms the user cannot enter, documents and unknown ids are not reported at all."""
    user = factories.UserFactory()
    mine = make_room(users=[(user, "reader")])
    someone_elses = make_room()
    document = factories.DocumentFactory(users=[(user, "owner")])
    unknown = uuid.uuid4()
    store = PresenceStore()
    store.join(str(someone_elses.id), "sub-ana", "PA_1", "Ana", user_id="u1")
    client = APIClient()
    client.force_login(user)

    response = client.get(
        "/api/v1.0/documents/rooms-presence/?ids="
        f"{mine.id!s},{someone_elses.id!s},{document.id!s},{unknown!s}"
    )

    assert response.status_code == 200
    assert response.json() == {"rooms": {str(mine.id): []}}


def test_api_documents_rooms_presence_without_ids():
    """No ids, no rooms."""
    client = APIClient()
    client.force_login(factories.UserFactory())

    response = client.get("/api/v1.0/documents/rooms-presence/")

    assert response.status_code == 200
    assert response.json() == {"rooms": {}}


def test_api_documents_rooms_presence_invalid_id():
    """An id that is not a UUID is a mistake, reported as such."""
    client = APIClient()
    client.force_login(factories.UserFactory())

    response = client.get("/api/v1.0/documents/rooms-presence/?ids=not-an-id")

    assert response.status_code == 400
    assert "ids" in response.json()


@override_settings(LIVEKIT_PRESENCE_MAX_ROOMS_PER_REQUEST=2)
def test_api_documents_rooms_presence_too_many_ids():
    """The number of rooms asked at once is capped."""
    client = APIClient()
    client.force_login(factories.UserFactory())
    ids = ",".join(str(uuid.uuid4()) for _ in range(3))

    response = client.get(f"/api/v1.0/documents/rooms-presence/?ids={ids}")

    assert response.status_code == 400


def test_api_documents_rooms_presence_anonymous():
    """Anonymous users get nothing."""
    response = APIClient().get(
        f"/api/v1.0/documents/rooms-presence/?ids={uuid.uuid4()!s}"
    )

    assert response.status_code == 401


# Status and live presence


def test_api_documents_room_presence_live_livekit_wins_over_the_webhooks():
    """Who LiveKit says is in the room is shown, even if no webhook was received."""
    user = factories.UserFactory()
    room = make_room(link_reach="authenticated")
    client = APIClient()
    client.force_login(user)

    live = {str(room.id): [{"identity": "x", "name": "Ana", "user_id": "u1"}]}
    with mock.patch.object(livekit_rooms, "live_participants", return_value=live):
        response = client.get(f"/api/v1.0/documents/{room.id!s}/room-presence/")

    assert response.status_code == 200
    assert response.json() == {
        "participants": [{"user_id": "u1", "name": "Ana", "status": "available"}]
    }


def test_api_documents_room_presence_shows_the_chosen_status():
    """The status chosen by a person is shown next to them in the room."""
    user = factories.UserFactory()
    other = factories.UserFactory()
    room = make_room(link_reach="authenticated")
    PresenceStore().join(str(room.id), "sub-1", "PA_1", "Bob", user_id=str(other.pk))
    PresenceStore().set_status(other.pk, "busy")
    client = APIClient()
    client.force_login(user)

    response = client.get(f"/api/v1.0/documents/{room.id!s}/room-presence/")

    assert response.json()["participants"] == [
        {"user_id": str(other.pk), "name": "Bob", "status": "busy"}
    ]


def test_api_user_status_anonymous():
    """The status needs a signed-in user."""
    response = APIClient().get("/api/v1.0/user-status/")

    assert response.status_code == 401


def test_api_user_status_default_then_change():
    """Everybody is available until they choose otherwise, and the choice is kept."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    assert client.get("/api/v1.0/user-status/").json() == {"status": "available"}

    response = client.put("/api/v1.0/user-status/", {"status": "away"}, format="json")

    assert response.status_code == 200
    assert client.get("/api/v1.0/user-status/").json() == {"status": "away"}


def test_api_user_status_refuses_unknown_status():
    """Only the known statuses are accepted."""
    client = APIClient()
    client.force_login(factories.UserFactory())

    response = client.put(
        "/api/v1.0/user-status/", {"status": "dancing"}, format="json"
    )

    assert response.status_code == 400


def test_api_documents_room_presence_only_in_the_last_room_joined():
    """Someone who went from a room to another is not shown in the first one."""
    user = factories.UserFactory()
    other = factories.UserFactory()
    old_room = make_room(link_reach="authenticated")
    new_room = make_room(link_reach="authenticated")
    store = PresenceStore()
    store.join(str(old_room.id), "sub-1", "PA_1", "Bob", user_id=str(other.pk))
    store.join(str(new_room.id), "sub-1", "PA_2", "Bob", user_id=str(other.pk))
    store.set_current_room(other.pk, str(old_room.id))
    store.set_current_room(other.pk, str(new_room.id))
    client = APIClient()
    client.force_login(user)

    old = client.get(f"/api/v1.0/documents/{old_room.id!s}/room-presence/")
    new = client.get(f"/api/v1.0/documents/{new_room.id!s}/room-presence/")

    assert old.json()["participants"] == []
    assert [p["name"] for p in new.json()["participants"]] == ["Bob"]


@override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION)
def test_api_documents_room_access_removes_the_person_from_their_previous_room():
    """Asking to join a room takes the person out of the one they were in."""
    user = factories.UserFactory()
    old_room = make_room(users=[(user, "owner")])
    new_room = make_room(users=[(user, "owner")])
    client = APIClient()
    client.force_login(user)

    with mock.patch.object(livekit_rooms, "remove_from_room") as remove:
        client.post(f"/api/v1.0/documents/{old_room.id!s}/room-access/")
        remove.assert_not_called()
        client.post(f"/api/v1.0/documents/{new_room.id!s}/room-access/")

    remove.assert_called_once()
    assert remove.call_args.args[0] == str(old_room.id)
