"""
Tests for Documents API endpoint in impress's core app: video rooms.

A room is a document of kind "room", a leaf of the tree. The accesses and the link
reach set on the folders above it apply to it, and decide what a person can do in the
LiveKit room: listen, speak, or moderate.
"""

from django.test import override_settings

import jwt
import pytest
from livekit.api import TokenVerifier
from rest_framework.test import APIClient

from core import factories
from core.choices import DocumentKindChoices
from core.models import Document

pytestmark = pytest.mark.django_db

LIVEKIT_CONFIGURATION = {
    "api_key": "devkey-padded-for-minimum-len!-livekit",
    "api_secret": "secret-key-padded-for-minimum-len!-livekit",
    "url": "http://127.0.0.1.nip.io:7880",
}


def room_access_url(room):
    """URL of the endpoint giving access to a room."""
    return f"/api/v1.0/documents/{room.id!s}/room-access/"


def claims_of(response):
    """Verified claims of the LiveKit token returned in a response."""
    token = response.json()["livekit"]["token"]
    return TokenVerifier(
        LIVEKIT_CONFIGURATION["api_key"], LIVEKIT_CONFIGURATION["api_secret"]
    ).verify(token)


def make_room(parent=None, **kwargs):
    """Create a room, restricted by default, optionally inside a folder."""
    kwargs.setdefault("link_reach", "restricted")
    return factories.DocumentFactory(
        kind=DocumentKindChoices.ROOM, parent=parent, **kwargs
    )


def make_folder(**kwargs):
    """Create a folder, restricted by default."""
    kwargs.setdefault("link_reach", "restricted")
    return factories.DocumentFactory(kind=DocumentKindChoices.FOLDER, **kwargs)


def test_api_documents_room_access_anonymous():
    """Anonymous users cannot get a token."""
    room = make_room(link_reach="public")

    response = APIClient().post(room_access_url(room))

    assert response.status_code == 401


def test_api_documents_room_access_not_a_room():
    """A regular document is not a room: nobody gets a token for it."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, "owner")])
    client = APIClient()
    client.force_login(user)

    response = client.post(room_access_url(document))

    assert response.status_code == 403


def test_api_documents_room_access_no_access():
    """A user without access to a restricted room is refused."""
    user = factories.UserFactory()
    room = make_room()
    client = APIClient()
    client.force_login(user)

    response = client.post(room_access_url(room))

    assert response.status_code == 403
    assert "livekit" not in response.json()


@pytest.mark.parametrize(
    "role,can_speak,is_moderator",
    [
        ["reader", False, False],
        ["commenter", True, False],
        ["editor", True, False],
        ["administrator", True, True],
        ["owner", True, True],
    ],
)
def test_api_documents_room_access_direct_role(role, can_speak, is_moderator):
    """The role on the room decides what the person can do in the LiveKit room."""
    user = factories.UserFactory()
    room = make_room(users=[(user, role)])
    client = APIClient()
    client.force_login(user)

    with override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION):
        response = client.post(room_access_url(room))

    assert response.status_code == 200
    content = response.json()
    assert content["livekit"]["url"] == LIVEKIT_CONFIGURATION["url"]
    assert content["livekit"]["room"] == str(room.id)
    assert content["abilities"] == {
        "join": True,
        "speak": can_speak,
        "moderate": is_moderator,
    }

    claims = claims_of(response)
    assert claims.video.room == str(room.id)
    assert claims.video.room_join is True
    assert claims.video.can_subscribe is True
    assert claims.video.can_publish is can_speak
    assert claims.video.room_admin is is_moderator
    assert bool(claims.video.can_publish_sources) is can_speak
    assert claims.identity == str(user.sub)


@pytest.mark.parametrize(
    "folder_role,can_speak,is_moderator",
    [
        ["reader", False, False],
        ["editor", True, False],
        ["administrator", True, True],
    ],
)
def test_api_documents_room_access_inherits_folder_role(
    folder_role, can_speak, is_moderator
):
    """A role given on a folder applies to every room it contains."""
    user = factories.UserFactory()
    folder = make_folder(users=[(user, folder_role)])
    room = make_room(parent=folder)
    client = APIClient()
    client.force_login(user)

    with override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION):
        response = client.post(room_access_url(room))

    assert response.status_code == 200
    assert response.json()["abilities"] == {
        "join": True,
        "speak": can_speak,
        "moderate": is_moderator,
    }


def test_api_documents_room_access_inherits_through_nested_folders():
    """A role on a top folder reaches a room several levels down."""
    user = factories.UserFactory()
    top = make_folder(users=[(user, "editor")])
    middle = factories.DocumentFactory(kind=DocumentKindChoices.FOLDER, parent=top)
    room = make_room(parent=middle)
    client = APIClient()
    client.force_login(user)

    with override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION):
        response = client.post(room_access_url(room))

    assert response.status_code == 200
    assert response.json()["abilities"]["speak"] is True


def test_api_documents_room_access_sibling_folder_gives_nothing():
    """A role on one folder does not open the rooms of another one."""
    user = factories.UserFactory()
    make_folder(users=[(user, "owner")])
    other_folder = make_folder()
    room = make_room(parent=other_folder)
    client = APIClient()
    client.force_login(user)

    response = client.post(room_access_url(room))

    assert response.status_code == 403


def test_api_documents_room_access_role_on_room_raises_folder_role():
    """A user can have more rights on a room than on its folder."""
    user = factories.UserFactory()
    folder = make_folder(users=[(user, "reader")])
    room = make_room(parent=folder, users=[(user, "editor")])
    client = APIClient()
    client.force_login(user)

    with override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION):
        response = client.post(room_access_url(room))

    assert response.status_code == 200
    assert response.json()["abilities"]["speak"] is True


@pytest.mark.parametrize(
    "link_role,can_speak",
    [["reader", False], ["commenter", True], ["editor", True]],
)
def test_api_documents_room_access_authenticated_link_on_folder(link_role, can_speak):
    """A folder open to authenticated users opens its rooms with the link role."""
    user = factories.UserFactory()
    folder = make_folder(link_reach="authenticated", link_role=link_role)
    room = make_room(parent=folder)
    client = APIClient()
    client.force_login(user)

    with override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION):
        response = client.post(room_access_url(room))

    assert response.status_code == 200
    assert response.json()["abilities"] == {
        "join": True,
        "speak": can_speak,
        "moderate": False,
    }


def test_api_documents_room_access_deleted_room():
    """Nobody can enter a room that was deleted, not even its owner."""
    user = factories.UserFactory()
    room = make_room(users=[(user, "owner")])
    room.soft_delete()
    client = APIClient()
    client.force_login(user)

    with override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION):
        response = client.post(room_access_url(room))

    assert response.status_code == 403


def test_api_documents_room_access_deleted_folder():
    """Nobody can enter a room whose folder was deleted."""
    user = factories.UserFactory()
    folder = make_folder(users=[(user, "owner")])
    room = make_room(parent=folder)
    folder.soft_delete()
    room.refresh_from_db()
    client = APIClient()
    client.force_login(user)

    with override_settings(LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION):
        response = client.post(room_access_url(room))

    assert response.status_code == 403


@override_settings(
    LIVEKIT_CONFIGURATION={"api_key": None, "api_secret": None, "url": None}
)
def test_api_documents_room_access_livekit_not_configured():
    """Without a LiveKit server, the endpoint says rooms are unavailable."""
    user = factories.UserFactory()
    room = make_room(users=[(user, "owner")])
    client = APIClient()
    client.force_login(user)

    response = client.post(room_access_url(room))

    assert response.status_code == 503
    assert response.json() == {
        "detail": "Video rooms are not available on this instance."
    }


@override_settings(
    LIVEKIT_CONFIGURATION=LIVEKIT_CONFIGURATION, LIVEKIT_TOKEN_TTL_SECONDS=120
)
def test_api_documents_room_access_token_is_short_lived():
    """The token expires after the configured delay."""
    user = factories.UserFactory()
    room = make_room(users=[(user, "owner")])
    client = APIClient()
    client.force_login(user)

    response = client.post(room_access_url(room))

    assert response.status_code == 200
    payload = jwt.decode(
        response.json()["livekit"]["token"],
        LIVEKIT_CONFIGURATION["api_secret"],
        algorithms=["HS256"],
    )
    assert payload["exp"] - payload["nbf"] == 120


def test_api_documents_room_access_get_not_allowed():
    """The token is only handed out on POST."""
    user = factories.UserFactory()
    room = make_room(users=[(user, "owner")])
    client = APIClient()
    client.force_login(user)

    response = client.get(room_access_url(room))

    assert response.status_code == 405


# Tree rules and API fields


def test_api_documents_room_cannot_have_children():
    """A room is a sub-space: nothing can be created below it."""
    user = factories.UserFactory()
    room = make_room(users=[(user, "owner")])
    client = APIClient()
    client.force_login(user)

    assert (
        client.get(f"/api/v1.0/documents/{room.id!s}/").json()["abilities"][
            "children_create"
        ]
        is False
    )
    response = client.post(
        f"/api/v1.0/documents/{room.id!s}/children/",
        {"title": "below the room", "kind": "room"},
    )

    assert response.status_code == 403
    assert not Document.objects.filter(title="below the room").exists()


@pytest.mark.parametrize("kind", ["folder", "room"])
def test_api_documents_room_can_be_created_in_a_folder(kind):
    """Folders and rooms are created under a folder like any other document."""
    user = factories.UserFactory()
    folder = make_folder(users=[(user, "owner")])
    client = APIClient()
    client.force_login(user)

    response = client.post(
        f"/api/v1.0/documents/{folder.id!s}/children/",
        {"title": "Standup", "kind": kind, "emoji": "🎙️"},
    )

    assert response.status_code == 201
    content = response.json()
    assert content["kind"] == kind
    assert content["emoji"] == "🎙️"
    created = Document.objects.get(id=content["id"])
    assert created.get_parent() == folder
    assert created.kind == kind


def test_api_documents_room_create_at_root_gives_owner_role():
    """A room created at the root belongs to its creator, who can moderate it."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    response = client.post(
        "/api/v1.0/documents/", {"title": "Lounge", "kind": "room", "emoji": "☕"}
    )

    assert response.status_code == 201
    room = Document.objects.get(id=response.json()["id"])
    assert room.get_room_abilities(user) == {
        "join": True,
        "speak": True,
        "moderate": True,
    }


def test_api_documents_create_defaults_to_a_regular_document():
    """Documents keep working as before: no kind and no emoji means a document."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    response = client.post("/api/v1.0/documents/", {"title": "Notes"})

    assert response.status_code == 201
    assert response.json()["kind"] == "document"
    assert response.json()["emoji"] == ""


def test_api_documents_create_rejects_unknown_kind():
    """Only the known kinds can be chosen."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    response = client.post("/api/v1.0/documents/", {"title": "Odd", "kind": "channel"})

    assert response.status_code == 400
    assert "kind" in response.json()


def test_api_documents_update_kind_is_refused_but_emoji_is_allowed():
    """A room cannot become a document, but it can be given another emoji."""
    user = factories.UserFactory()
    room = make_room(users=[(user, "owner")], emoji="☕")
    client = APIClient()
    client.force_login(user)

    refused = client.patch(
        f"/api/v1.0/documents/{room.id!s}/", {"kind": "document"}, format="json"
    )
    allowed = client.patch(
        f"/api/v1.0/documents/{room.id!s}/", {"emoji": "🎧"}, format="json"
    )

    room.refresh_from_db()
    assert refused.status_code == 400
    assert room.kind == "room"
    assert allowed.status_code == 200
    assert room.emoji == "🎧"


def test_api_documents_list_exposes_kind_and_emoji_read_only():
    """The list shows the kind and the emoji so the left panel can draw the tree."""
    user = factories.UserFactory()
    make_room(users=[(user, "reader")], emoji="🔊", title="Voice")
    client = APIClient()
    client.force_login(user)

    response = client.get("/api/v1.0/documents/")

    assert response.status_code == 200
    result = response.json()["results"][0]
    assert result["kind"] == "room"
    assert result["emoji"] == "🔊"
