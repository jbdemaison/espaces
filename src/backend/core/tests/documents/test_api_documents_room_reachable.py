"""
Tests for the "reachable" people of the video rooms: the favorite sub-spaces, the
inbox they stay connected to, and how they are shown to the others.
"""

from unittest import mock

from django.test import override_settings

import pytest
from livekit.api import TokenVerifier
from rest_framework.test import APIClient

from core import factories, models
from core.choices import DocumentKindChoices
from core.services import livekit_rooms
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


@pytest.fixture(autouse=True)
def no_live_livekit():
    """LiveKit cannot be asked, unless a test says who is connected to their inbox."""
    with mock.patch.object(livekit_rooms, "live_participants", return_value=None):
        yield


@pytest.fixture(autouse=True)
def clean_presence():
    """Presence lives in Redis, outside of the test transaction: empty it around tests."""
    redis = PresenceStore._redis()  # pylint: disable=protected-access
    prefixes = (
        KEY_PREFIX,
        STATUS_PREFIX,
        SITUATION_PREFIX,
        REACHABLE_PREFIX,
        CURRENT_ROOM_PREFIX,
    )
    for prefix in prefixes:
        for key in redis.scan_iter(f"{prefix}:*"):
            redis.delete(key)
    yield
    for prefix in prefixes:
        for key in redis.scan_iter(f"{prefix}:*"):
            redis.delete(key)


def make_room(**kwargs):
    """A room anybody signed in can enter."""
    kwargs.setdefault("link_reach", "authenticated")
    return factories.DocumentFactory(kind=DocumentKindChoices.ROOM, **kwargs)


def login(user):
    """A client signed in as the user."""
    client = APIClient()
    client.force_login(user)
    return client


def favorite(user, room, reachable=False):
    """Make the room a favorite of the user."""
    return models.DocumentFavorite.objects.create(
        user=user, document=room, reachable=reachable
    )


# Reachable flag


def make_space(**kwargs):
    """A space anybody signed in can see."""
    kwargs.setdefault("link_reach", "authenticated")
    return factories.DocumentFactory(kind=DocumentKindChoices.FOLDER, **kwargs)


def test_api_documents_reachable_only_for_a_favorite():
    """A space that is not a favorite cannot be marked reachable."""
    user = factories.UserFactory()
    space = make_space()

    response = login(user).put(
        f"/api/v1.0/documents/{space.id!s}/reachable/",
        {"reachable": True},
        format="json",
    )

    assert response.status_code == 400


def test_api_documents_reachable_only_for_a_space():
    """A sub-space (a room) is never reachable by itself."""
    user = factories.UserFactory()
    room = make_room()
    favorite(user, room)

    response = login(user).put(
        f"/api/v1.0/documents/{room.id!s}/reachable/",
        {"reachable": True},
        format="json",
    )

    assert response.status_code == 400


def test_api_documents_reachable_set_and_unset():
    """A favorite space can be marked reachable, then not."""
    user = factories.UserFactory()
    space = make_space()
    favorite(user, space)
    client = login(user)
    url = f"/api/v1.0/documents/{space.id!s}/reachable/"

    assert client.put(url, {"reachable": True}, format="json").status_code == 200
    assert models.DocumentFavorite.objects.get(user=user, document=space).reachable

    assert client.put(url, {"reachable": False}, format="json").status_code == 200
    assert not models.DocumentFavorite.objects.get(user=user, document=space).reachable


def test_api_documents_reachable_needs_a_boolean():
    """Anything but true or false is refused."""
    user = factories.UserFactory()
    space = make_space()
    favorite(user, space)

    response = login(user).put(
        f"/api/v1.0/documents/{space.id!s}/reachable/",
        {"reachable": "yes"},
        format="json",
    )

    assert response.status_code == 400


def test_api_documents_reachable_refused_without_access():
    """Somebody who cannot see the space cannot make it reachable."""
    user = factories.UserFactory()
    space = make_space(link_reach="restricted")

    response = login(user).put(
        f"/api/v1.0/documents/{space.id!s}/reachable/",
        {"reachable": True},
        format="json",
    )

    assert response.status_code == 403


def test_api_documents_favorite_spaces_lists_spaces_with_all_their_rooms():
    """The favorites page gets the favorite spaces only, with their favorite sub-spaces."""
    user = factories.UserFactory()
    space = make_space(title="Lab")
    starred = make_room(parent=space, title="Design")
    make_room(parent=space, title="Bizdev")  # not a favorite: not listed
    other_space = make_space(title="Other")
    in_other = make_room(parent=other_space, title="Chat")
    ignored = make_space(title="Ignored")
    make_room(parent=ignored, title="Nothing")
    favorite(user, space, reachable=True)
    favorite(user, starred)
    favorite(user, in_other)

    response = login(user).get("/api/v1.0/documents/favorite-spaces/")

    assert response.status_code == 200
    results = {item["id"]: item for item in response.json()["results"]}
    # a space is listed only when it is a favorite itself, not for a starred sub-space
    assert set(results) == {str(space.id)}
    assert results[str(space.id)] == {
        "id": str(space.id),
        "title": "Lab",
        "emoji": space.emoji,
        "favorite": True,
        "reachable": True,
        "rooms": [
            {
                "id": str(starred.id),
                "title": "Design",
                "emoji": starred.emoji,
                "favorite": True,
            },
        ],
    }
    assert in_other


def test_api_documents_favorite_spaces_anonymous():
    """The list needs a signed-in user."""
    assert APIClient().get("/api/v1.0/documents/favorite-spaces/").status_code == 401


# Reachable


def test_api_user_status_reachable_is_separate_from_the_situation():
    """ "Reachable" is switched on whatever the situation, and does not change it."""
    user = factories.UserFactory()
    client = login(user)
    client.put(
        "/api/v1.0/user-status/",
        {"emoji": "🎧", "text": "Focus"},
        format="json",
    )

    response = client.put("/api/v1.0/user-status/", {"reachable": True}, format="json")

    assert response.status_code == 200
    expected = {"emoji": "🎧", "text": "Focus", "reachable": True}
    assert response.json() == expected
    assert client.get("/api/v1.0/user-status/").json() == expected


def test_api_user_status_former_reachable_status_still_counts():
    """Somebody who was "reachable" before the change stays reachable."""
    user = factories.UserFactory()
    redis = PresenceStore._redis()  # pylint: disable=protected-access
    redis.set(f"{STATUS_PREFIX}:{user.pk}", "reachable")

    assert PresenceStore().reachable([user.pk]) == {str(user.pk)}

    PresenceStore().set_reachable(user.pk, False)

    assert PresenceStore().reachable([user.pk]) == set()


# Inbox


def test_api_user_inbox_anonymous():
    """The inbox needs a signed-in user."""
    assert APIClient().post("/api/v1.0/user-inbox/").status_code == 401


@override_settings(LIVEKIT_CONFIGURATION={})
def test_api_user_inbox_not_configured():
    """Without a LiveKit server there is no inbox."""
    assert (
        login(factories.UserFactory()).post("/api/v1.0/user-inbox/").status_code == 503
    )


@override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION)
def test_api_user_inbox_token_is_listen_only():
    """The inbox token opens one personal room, without publishing."""
    user = factories.UserFactory()

    response = login(user).post("/api/v1.0/user-inbox/")

    assert response.status_code == 200
    details = response.json()["livekit"]
    assert details["room"] == f"inbox-{user.pk}"
    claims = TokenVerifier(
        LIVEKIT_CONFIGURATION["api_key"], LIVEKIT_CONFIGURATION["api_secret"]
    ).verify(details["token"])
    assert claims.video.room == f"inbox-{user.pk}"
    assert not claims.video.can_publish
    assert not claims.video.can_publish_data
    # subscribing is what lets the invitations pushed to the inbox arrive
    assert claims.video.can_subscribe
    assert claims.attributes["user_id"] == str(user.pk)


# Reachable people in the spaces


def reachable_in(viewer, space, online):
    """What the left panel gets for the space, with `online` users on their inbox."""
    with mock.patch.object(
        livekit_rooms,
        "online_inboxes",
        side_effect=lambda users: (
            {str(u.pk) for u in users} & {str(u.pk) for u in online}
        ),
    ):
        response = login(viewer).get(
            f"/api/v1.0/documents/spaces-reachable/?ids={space.id!s}"
        )
    assert response.status_code == 200
    return response.json()["spaces"]


def test_api_documents_spaces_reachable_shows_their_situation():
    """The situation of a reachable person is shown next to them."""
    viewer = factories.UserFactory()
    other = factories.UserFactory(full_name="Ana Martin")
    space = make_space()
    favorite(other, space, reachable=True)
    PresenceStore().set_reachable(other.pk, True)
    PresenceStore().set_situation(other.pk, "🎧", "Focus")

    [person] = reachable_in(viewer, space, online=[other])[str(space.id)]

    assert person["situation"] == {"emoji": "🎧", "text": "Focus"}


def test_api_documents_spaces_reachable_shows_reachable_people():
    """Someone reachable, online and favoring the space is shown to the others."""
    viewer = factories.UserFactory()
    other = factories.UserFactory(full_name="Ana Martin")
    space = make_space()
    favorite(other, space, reachable=True)
    PresenceStore().set_reachable(other.pk, True)

    assert reachable_in(viewer, space, online=[other]) == {
        str(space.id): [
            {
                "user_id": str(other.pk),
                "name": "Ana Martin",
                "avatar_version": None,
                "situation": None,
                "busy": False,
            }
        ]
    }


def test_api_documents_spaces_reachable_not_oneself():
    """The list is for the others: nobody sees themselves there."""
    viewer = factories.UserFactory()
    space = make_space()
    favorite(viewer, space, reachable=True)
    PresenceStore().set_reachable(viewer.pk, True)

    assert reachable_in(viewer, space, online=[viewer]) == {str(space.id): []}


def test_api_documents_spaces_reachable_needs_the_inbox_to_be_connected():
    """A browser that was closed makes the person disappear from every space."""
    viewer = factories.UserFactory()
    other = factories.UserFactory()
    space = make_space()
    favorite(other, space, reachable=True)
    PresenceStore().set_reachable(other.pk, True)

    assert reachable_in(viewer, space, online=[]) == {}


def test_api_documents_spaces_reachable_needs_the_switch():
    """Switching "reachable" off ends being reachable, whatever the spaces checked."""
    viewer = factories.UserFactory()
    other = factories.UserFactory()
    space = make_space()
    favorite(other, space, reachable=True)
    PresenceStore().set_reachable(other.pk, True)
    PresenceStore().set_reachable(other.pk, False)

    assert reachable_in(viewer, space, online=[other]) == {}


def test_api_documents_spaces_reachable_needs_the_space_to_be_checked():
    """Only the spaces the person marked reachable show them."""
    viewer = factories.UserFactory()
    other = factories.UserFactory()
    space = make_space()
    favorite(other, space, reachable=False)
    PresenceStore().set_reachable(other.pk, True)

    assert reachable_in(viewer, space, online=[other]) == {}


def test_api_documents_spaces_reachable_not_when_in_a_room_of_the_space():
    """Somebody inside a sub-space is shown there, not as reachable too."""
    viewer = factories.UserFactory()
    other = factories.UserFactory()
    space = make_space()
    room = make_room(parent=space)
    favorite(other, space, reachable=True)
    PresenceStore().set_reachable(other.pk, True)
    PresenceStore().join(str(room.id), "sub-1", "PA_1", "Bob", user_id=str(other.pk))

    assert reachable_in(viewer, space, online=[other]) == {}


def test_api_documents_spaces_reachable_lost_with_the_access():
    """A person who lost the right to see the space is no longer offered."""
    viewer = factories.UserFactory()
    other = factories.UserFactory()
    space = make_space(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=space, user=viewer, role="reader")
    access = factories.UserDocumentAccessFactory(
        document=space, user=other, role="reader"
    )
    favorite(other, space, reachable=True)
    PresenceStore().set_reachable(other.pk, True)
    assert reachable_in(viewer, space, online=[other])

    access.delete()

    assert reachable_in(viewer, space, online=[other]) == {}


def test_api_documents_spaces_reachable_unfavorited_disappears():
    """Removing the favorite removes the person from the space's reachable list."""
    viewer = factories.UserFactory()
    other = factories.UserFactory()
    space = make_space()
    favorite(other, space, reachable=True)
    PresenceStore().set_reachable(other.pk, True)
    assert reachable_in(viewer, space, online=[other])

    login(other).delete(f"/api/v1.0/documents/{space.id!s}/favorite/")

    assert reachable_in(viewer, space, online=[other]) == {}


def test_api_documents_spaces_reachable_hides_spaces_one_cannot_see():
    """Asking for a space one cannot see tells nothing."""
    viewer = factories.UserFactory()
    other = factories.UserFactory()
    space = make_space(link_reach="restricted")
    favorite(other, space, reachable=True)
    PresenceStore().set_reachable(other.pk, True)

    assert reachable_in(viewer, space, online=[other]) == {}


def test_api_documents_rooms_presence_no_longer_lists_reachable_people():
    """A sub-space only shows who is in it."""
    viewer = factories.UserFactory()
    other = factories.UserFactory()
    space = make_space()
    room = make_room(parent=space)
    favorite(other, space, reachable=True)
    PresenceStore().set_reachable(other.pk, True)

    response = login(viewer).get(f"/api/v1.0/documents/rooms-presence/?ids={room.id!s}")

    assert response.json() == {"rooms": {str(room.id): []}}


# Reachable people in a room


def presence_in(viewer, room, online):
    """The people of a room as the viewer gets them, `online` being on their inbox."""
    with mock.patch.object(
        livekit_rooms,
        "online_inboxes",
        side_effect=lambda users: (
            {str(u.pk) for u in users} & {str(u.pk) for u in online}
        ),
    ):
        response = login(viewer).get(f"/api/v1.0/documents/{room.id!s}/room-presence/")
    assert response.status_code == 200
    return response.json()["participants"]


def test_api_documents_room_presence_says_who_is_reachable_from_the_space():
    """Somebody in a room who can be invited from its space is marked reachable."""
    viewer = factories.UserFactory()
    other = factories.UserFactory(full_name="Ana Martin")
    space = make_space()
    room = make_room(parent=space)
    favorite(other, space, reachable=True)
    PresenceStore().set_reachable(other.pk, True)
    PresenceStore().set_situation(other.pk, "🍽️", "Lunch")
    PresenceStore().join(str(room.id), "sub-1", "PA_1", "Ana", user_id=str(other.pk))

    [person] = presence_in(viewer, room, online=[other])

    assert person["reachable"] is True
    assert person["situation"] == {"emoji": "🍽️", "text": "Lunch"}


@pytest.mark.parametrize(
    "case", ["switch_off", "space_not_marked", "not_connected", "not_a_favorite"]
)
def test_api_documents_room_presence_reachable_needs_every_condition(case):
    """Not reachable: switch off, space not marked, inbox not connected, no favorite."""
    viewer = factories.UserFactory()
    other = factories.UserFactory()
    space = make_space()
    room = make_room(parent=space)
    if case != "not_a_favorite":
        favorite(other, space, reachable=case != "space_not_marked")
    if case != "switch_off":
        PresenceStore().set_reachable(other.pk, True)
    PresenceStore().join(str(room.id), "sub-1", "PA_1", "Ana", user_id=str(other.pk))

    [person] = presence_in(
        viewer, room, online=[] if case == "not_connected" else [other]
    )

    assert person["reachable"] is False


def test_api_documents_rooms_presence_reachable_is_per_space():
    """Being reachable in one space says nothing about the rooms of another."""
    viewer = factories.UserFactory()
    other = factories.UserFactory()
    space = make_space()
    elsewhere = make_space()
    room = make_room(parent=elsewhere)
    favorite(other, space, reachable=True)
    PresenceStore().set_reachable(other.pk, True)
    PresenceStore().join(str(room.id), "sub-1", "PA_1", "Ana", user_id=str(other.pk))

    [person] = presence_in(viewer, room, online=[other])

    assert person["reachable"] is False
