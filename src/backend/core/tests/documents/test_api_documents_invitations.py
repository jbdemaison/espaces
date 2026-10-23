"""
Tests for the invitations to join a video room, sent to people who are reachable.
"""

from unittest import mock

from django.test import override_settings

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.choices import DocumentKindChoices
from core.services import livekit_invitations, livekit_rooms
from core.services.livekit_presence import (
    CURRENT_ROOM_PREFIX,
    KEY_PREFIX,
    REACHABLE_PREFIX,
    SITUATION_PREFIX,
    STATUS_PREFIX,
    PresenceStore,
)

pytestmark = pytest.mark.django_db

LIVEKIT_CONFIGURATION = {
    "api_key": "devkey-padded-for-minimum-len!-livekit",
    "api_secret": "secret-key-padded-for-minimum-len!-livekit",
    "url": "http://127.0.0.1.nip.io:7880",
}

PREFIXES = (
    KEY_PREFIX,
    STATUS_PREFIX,
    SITUATION_PREFIX,
    REACHABLE_PREFIX,
    CURRENT_ROOM_PREFIX,
    livekit_invitations.INVITATION_PREFIX,
    livekit_invitations.PENDING_PREFIX,
)


@pytest.fixture(autouse=True)
def clean_redis():
    """Everything lives in Redis, outside of the test transaction: empty it."""
    redis = PresenceStore._redis()  # pylint: disable=protected-access
    for prefix in PREFIXES:
        for key in redis.scan_iter(f"{prefix}:*"):
            redis.delete(key)
    yield
    for prefix in PREFIXES:
        for key in redis.scan_iter(f"{prefix}:*"):
            redis.delete(key)


@pytest.fixture(autouse=True)
def livekit():
    """Nobody is on LiveKit, except those a test puts online; sending is recorded."""
    sent = []
    online = set()

    def send(user, message):
        sent.append((user, message))
        return True

    with (
        override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION),
        mock.patch.object(livekit_rooms, "live_participants", return_value=None),
        mock.patch.object(
            livekit_rooms,
            "online_inboxes",
            side_effect=lambda users: {str(u.pk) for u in users} & online,
        ),
        mock.patch.object(livekit_rooms, "send_to_inbox", side_effect=send),
    ):
        yield mock.Mock(sent=sent, online=online)


def login(user):
    """A client signed in as the user."""
    client = APIClient()
    client.force_login(user)
    return client


def make_scene(livekit, reachable=True):
    """A room, a person who can be invited to it and someone who wants to invite."""
    space = factories.DocumentFactory(
        kind=DocumentKindChoices.FOLDER, title="Lab", link_reach="authenticated"
    )
    room = factories.DocumentFactory(
        parent=space,
        kind=DocumentKindChoices.ROOM,
        title="Design",
        link_reach="authenticated",
    )
    invited = factories.UserFactory(full_name="Ana Martin")
    inviter = factories.UserFactory(full_name="Bob Durand")
    models.DocumentFavorite.objects.create(user=invited, document=space, reachable=True)
    if reachable:
        PresenceStore().set_reachable(invited.pk, True)
        livekit.online.add(str(invited.pk))
    return room, invited, inviter


def invite(inviter, room, invited, **extra):
    """The inviter invites somebody to the room."""
    return login(inviter).post(
        "/api/v1.0/invitations/",
        {"room_id": str(room.id), "user_id": str(invited.pk), **extra},
        format="json",
    )


def test_api_invitations_anonymous():
    """Only signed in users can invite."""
    response = APIClient().post("/api/v1.0/invitations/", {}, format="json")
    assert response.status_code == 401


def test_api_invitations_create_pushes_the_invitation_to_the_inbox(livekit):
    """The person invited gets who invites them, to which room and in which space."""
    room, invited, inviter = make_scene(livekit)

    response = invite(inviter, room, invited)

    assert response.status_code == 201
    [(target, message)] = livekit.sent
    assert target == invited
    assert message["type"] == "invitation"
    assert message["id"] == response.json()["id"]
    assert message["expires_at"] == response.json()["expires_at"]
    assert message["from"] == {"user_id": str(inviter.pk), "name": "Bob Durand"}
    assert message["room"] == {
        "id": str(room.id),
        "title": "Design",
        "emoji": room.emoji,
    }
    assert message["space"]["title"] == "Lab"


def test_api_invitations_create_carries_the_reason(livekit):
    """A short message written by the inviter reaches the person invited, cleaned up."""
    room, invited, inviter = make_scene(livekit)

    response = invite(inviter, room, invited, message="  On y va\n\tpour la revue  ")

    assert response.status_code == 201
    [(_target, message)] = livekit.sent
    assert message["message"] == "On y va pour la revue"


def test_api_invitations_create_without_reason(livekit):
    """The reason is optional."""
    room, invited, inviter = make_scene(livekit)
    assert invite(inviter, room, invited).status_code == 201
    assert livekit.sent[0][1]["message"] == ""


def test_api_invitations_create_reason_is_limited(livekit):
    """A reason longer than 140 characters, or not a text, is refused."""
    room, invited, inviter = make_scene(livekit)
    assert invite(inviter, room, invited, message="x" * 141).status_code == 400
    assert invite(inviter, room, invited, message=["x"]).status_code == 400
    assert livekit.sent == []


def test_api_invitations_create_needs_valid_ids():
    """Ids that are not ids are refused."""
    user = factories.UserFactory()
    response = login(user).post(
        "/api/v1.0/invitations/", {"room_id": "x", "user_id": "y"}, format="json"
    )
    assert response.status_code == 400


def test_api_invitations_create_refused_without_access_to_the_room(livekit):
    """Somebody who cannot enter the room cannot invite people to it."""
    room, invited, inviter = make_scene(livekit)
    models.Document.objects.update(link_reach="restricted")

    assert invite(inviter, room, invited).status_code == 403
    assert not livekit.sent


def test_api_invitations_create_not_for_somebody_not_reachable(livekit):
    """Nobody is invited unless they are shown as reachable in the room."""
    room, invited, inviter = make_scene(livekit, reachable=False)

    response = invite(inviter, room, invited)

    assert response.status_code == 409
    assert response.json() == {"code": "not_reachable"}
    assert not livekit.sent


def test_api_invitations_create_not_for_oneself(livekit):
    """One cannot invite oneself."""
    room, invited, _ = make_scene(livekit)

    assert invite(invited, room, invited).status_code == 409


def test_api_invitations_create_for_somebody_in_another_room_of_the_space(livekit):
    """Somebody reachable from the space can be invited from one of its other rooms."""
    room, invited, inviter = make_scene(livekit)
    other_room = factories.DocumentFactory(
        parent=room.get_parent(),
        kind=DocumentKindChoices.ROOM,
        title="Detente",
        link_reach="authenticated",
    )
    PresenceStore().join(
        str(other_room.id), "ana", "sid", "Ana Martin", user_id=str(invited.pk)
    )

    response = invite(inviter, room, invited)

    assert response.status_code == 201
    [(target, message)] = livekit.sent
    assert target == invited
    assert message["room"]["id"] == str(room.id)


def test_api_invitations_create_not_to_the_room_they_are_in(livekit):
    """Inviting somebody to the room they are already in is refused."""
    room, invited, inviter = make_scene(livekit)
    PresenceStore().join(
        str(room.id), "ana", "sid", "Ana Martin", user_id=str(invited.pk)
    )

    response = invite(inviter, room, invited)

    assert response.status_code == 409
    assert response.json() == {"code": "already_there"}
    assert not livekit.sent


def test_api_invitations_create_stops_after_three_waiting(livekit):
    """A fourth invitation waits for none of the three first to get an answer."""
    room, invited, _ = make_scene(livekit)
    inviters = [factories.UserFactory() for _ in range(4)]

    codes = [invite(person, room, invited).status_code for person in inviters]

    assert codes == [201, 201, 201, 409]
    refused = invite(inviters[3], room, invited)
    assert refused.json() == {"code": "busy"}

    # the space shows the person as busy to everybody
    space = models.Document.objects.get(path=room.path[: -models.Document.steplen])
    viewer = login(inviters[3]).get(
        f"/api/v1.0/documents/spaces-reachable/?ids={space.id}"
    )
    [person] = viewer.json()["spaces"][str(space.id)]
    assert person["busy"] is True


def test_api_invitations_answer_frees_a_place(livekit):
    """Answering an invitation, whatever the answer, lets another one come."""
    room, invited, _ = make_scene(livekit)
    inviters = [factories.UserFactory() for _ in range(4)]
    first = [invite(person, room, invited).json()["id"] for person in inviters[:3]]

    answer = login(invited).post(
        f"/api/v1.0/invitations/{first[0]}/answer/", {"answer": "ignore"}, format="json"
    )

    assert answer.status_code == 200
    assert invite(inviters[3], room, invited).status_code == 201


def test_api_invitations_not_delivered_is_forgotten(livekit):
    """If LiveKit cannot carry the invitation, it does not count as waiting."""
    room, invited, inviter = make_scene(livekit)
    with mock.patch.object(livekit_rooms, "send_to_inbox", return_value=False):
        response = invite(inviter, room, invited)

    assert response.status_code == 409
    assert response.json() == {"code": "unreachable"}
    assert livekit_invitations.pending_counts([invited.pk]) == {str(invited.pk): 0}


def test_api_invitations_inviter_follows_the_answer(livekit):
    """The inviter sees `pending`, then `unavailable` once the other declined."""
    room, invited, inviter = make_scene(livekit)
    invitation_id = invite(inviter, room, invited).json()["id"]

    follow = login(inviter).get(f"/api/v1.0/invitations/{invitation_id}/")
    assert follow.json() == {"status": "pending"}

    answer = login(invited).post(
        f"/api/v1.0/invitations/{invitation_id}/answer/",
        {"answer": "unavailable"},
        format="json",
    )
    assert answer.json() == {"status": "unavailable", "room_id": str(room.id)}

    follow = login(inviter).get(f"/api/v1.0/invitations/{invitation_id}/")
    assert follow.json() == {"status": "unavailable"}


def test_api_invitations_ignored_looks_unanswered(livekit):
    """Ignoring an invitation tells the inviter nothing."""
    room, invited, inviter = make_scene(livekit)
    invitation_id = invite(inviter, room, invited).json()["id"]

    login(invited).post(
        f"/api/v1.0/invitations/{invitation_id}/answer/",
        {"answer": "ignore"},
        format="json",
    )

    follow = login(inviter).get(f"/api/v1.0/invitations/{invitation_id}/")
    assert follow.json() == {"status": "pending"}


def test_api_invitations_accepted(livekit):
    """The inviter learns that the invitation was accepted."""
    room, invited, inviter = make_scene(livekit)
    invitation_id = invite(inviter, room, invited).json()["id"]

    answer = login(invited).post(
        f"/api/v1.0/invitations/{invitation_id}/answer/",
        {"answer": "accept"},
        format="json",
    )

    assert answer.json() == {"status": "accepted", "room_id": str(room.id)}
    follow = login(inviter).get(f"/api/v1.0/invitations/{invitation_id}/")
    assert follow.json() == {"status": "accepted"}


def test_api_invitations_expire_after_a_minute(livekit):
    """Past its minute an invitation is `expired` and cannot be accepted."""
    room, invited, inviter = make_scene(livekit)
    invitation_id = invite(inviter, room, invited).json()["id"]

    with mock.patch(
        "core.services.livekit_invitations.time.time",
        return_value=__import__("time").time()
        + livekit_invitations.INVITATION_TTL_SECONDS
        + 1,
    ):
        follow = login(inviter).get(f"/api/v1.0/invitations/{invitation_id}/")
        answer = login(invited).post(
            f"/api/v1.0/invitations/{invitation_id}/answer/",
            {"answer": "accept"},
            format="json",
        )
        assert livekit_invitations.pending_counts([invited.pk]) == {str(invited.pk): 0}

    assert follow.json() == {"status": "expired"}
    assert answer.json()["status"] == "expired"


def test_api_invitations_only_the_person_invited_answers(livekit):
    """Neither the inviter nor a third person can answer for the one invited."""
    room, invited, inviter = make_scene(livekit)
    invitation_id = invite(inviter, room, invited).json()["id"]
    stranger = factories.UserFactory()

    for person in (inviter, stranger):
        response = login(person).post(
            f"/api/v1.0/invitations/{invitation_id}/answer/",
            {"answer": "accept"},
            format="json",
        )
        assert response.status_code == 404


def test_api_invitations_only_the_inviter_follows_it(livekit):
    """Others do not learn what became of an invitation."""
    room, invited, inviter = make_scene(livekit)
    invitation_id = invite(inviter, room, invited).json()["id"]

    response = login(invited).get(f"/api/v1.0/invitations/{invitation_id}/")

    assert response.status_code == 404


def test_api_invitations_answer_must_be_known(livekit):
    """Only the three answers exist."""
    room, invited, inviter = make_scene(livekit)
    invitation_id = invite(inviter, room, invited).json()["id"]

    response = login(invited).post(
        f"/api/v1.0/invitations/{invitation_id}/answer/",
        {"answer": "maybe"},
        format="json",
    )

    assert response.status_code == 400
