"""
Tests for what happens to the people in a video room when their rights change.

LiveKit is never called: `_apply`, the only place that talks to it, is replaced, except
in the tests that check the requests it builds.
"""

from unittest import mock

import pytest
from livekit.api import RoomParticipantIdentity, TrackSource, TwirpError

from core import factories
from core.choices import DocumentKindChoices
from core.services import livekit_rooms
from core.services.livekit_presence import KEY_PREFIX, PresenceStore
from core.tasks import access as access_tasks

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def clean_presence():
    """Presence lives in Redis, outside of the test transaction: empty it around tests."""
    redis = PresenceStore._redis()  # pylint: disable=protected-access
    for key in redis.scan_iter(f"{KEY_PREFIX}:*"):
        redis.delete(key)
    yield
    for key in redis.scan_iter(f"{KEY_PREFIX}:*"):
        redis.delete(key)


@pytest.fixture(name="apply")
def apply_fixture():
    """
    Replace the calls to LiveKit, and the collaboration server, by recorders.

    The tests of the project only record the resets that are queued: here the task runs
    for real, to see what it does to the rooms.
    """
    task = access_tasks.reset_service_connections_in_cascade
    with (
        mock.patch.object(livekit_rooms, "_apply", return_value=set()) as apply,
        mock.patch("core.tasks.access.YHubService") as yhub,
        mock.patch.object(task, "delay", side_effect=task),
    ):
        apply.yhub = yhub
        yield apply


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


def enter(room, user, moderator=False):
    """Put a user in a room, as the webhook does when they connect."""
    PresenceStore().join(
        str(room.id),
        str(user.sub),
        f"PA_{user.pk}",
        user.full_name or "someone",
        user_id=str(user.pk),
        moderator=moderator,
    )


def calls(apply):
    """What was asked of LiveKit, as [(room, to_remove, to_update), ...]."""
    return [call.args for call in apply.call_args_list]


# Reaction to a change of accesses


def test_services_livekit_rooms_removed_access_removes_the_person(
    apply, django_capture_on_commit_callbacks
):
    """Someone who loses the access that let them in is removed from the room."""
    user = factories.UserFactory()
    folder = make_folder(users=[(user, "editor")])
    room = make_room(parent=folder)
    enter(room, user)

    with django_capture_on_commit_callbacks(execute=True):
        folder.accesses.get(user=user).delete()

    assert calls(apply) == [(str(room.id), [str(user.sub)], {})]
    assert PresenceStore().participants(str(room.id)) == []


def test_services_livekit_rooms_lower_role_keeps_the_person_but_stops_their_voice(
    apply, django_capture_on_commit_callbacks
):
    """Someone downgraded to reader stays in the room and can only listen."""
    user = factories.UserFactory()
    folder = make_folder(users=[(user, "editor")])
    room = make_room(parent=folder)
    enter(room, user)
    access = folder.accesses.get(user=user)

    access.role = "reader"
    with django_capture_on_commit_callbacks(execute=True):
        access.save()

    assert calls(apply) == [(str(room.id), [], {str(user.sub): False})]
    assert len(PresenceStore().participants(str(room.id))) == 1


def test_services_livekit_rooms_higher_role_gives_the_voice_back(
    apply, django_capture_on_commit_callbacks
):
    """Someone promoted to editor can speak without reconnecting."""
    user = factories.UserFactory()
    folder = make_folder(users=[(user, "reader")])
    room = make_room(parent=folder)
    enter(room, user)
    access = folder.accesses.get(user=user)

    access.role = "editor"
    with django_capture_on_commit_callbacks(execute=True):
        access.save()

    assert calls(apply) == [(str(room.id), [], {str(user.sub): True})]


def test_services_livekit_rooms_moderator_who_is_demoted_is_removed(
    apply, django_capture_on_commit_callbacks
):
    """
    A moderator keeps their rights as long as their connection lives: when they lose
    them, they are removed and come back with a token that does not carry them.
    """
    user = factories.UserFactory()
    room = make_room(users=[(user, "administrator")])
    enter(room, user, moderator=True)
    access = room.accesses.get(user=user)

    access.role = "editor"
    with django_capture_on_commit_callbacks(execute=True):
        access.save()

    assert calls(apply) == [(str(room.id), [str(user.sub)], {})]


def test_services_livekit_rooms_only_the_person_concerned_is_checked(
    apply, django_capture_on_commit_callbacks
):
    """An access that changes for one person leaves the others in the room alone."""
    ana = factories.UserFactory()
    bob = factories.UserFactory()
    folder = make_folder(users=[(ana, "editor"), (bob, "editor")])
    room = make_room(parent=folder)
    enter(room, ana)
    enter(room, bob)

    with django_capture_on_commit_callbacks(execute=True):
        folder.accesses.get(user=bob).delete()

    # the check may also look at the others, it must never remove them
    assert [i for c in calls(apply) for i in c[1]] == [str(bob.sub)]
    assert all(str(ana.sub) not in c[1] for c in calls(apply))
    assert [p["user_id"] for p in PresenceStore().participants(str(room.id))] == [
        str(ana.pk)
    ]


def test_services_livekit_rooms_access_kept_through_another_folder_role(
    apply, django_capture_on_commit_callbacks
):
    """Losing the access on a room is nothing when a folder above still gives it."""
    user = factories.UserFactory()
    folder = make_folder(users=[(user, "editor")])
    room = make_room(parent=folder, users=[(user, "reader")])
    enter(room, user)

    with django_capture_on_commit_callbacks(execute=True):
        room.accesses.get(user=user).delete()

    # checked once per reset asked for: what matters is that nobody is removed
    expected = (str(room.id), [], {str(user.sub): True})
    assert calls(apply)
    assert all(call == expected for call in calls(apply))


def test_services_livekit_rooms_rooms_are_not_sent_to_the_collaboration_server(
    apply, django_capture_on_commit_callbacks
):
    """A room has no collaborative content: only the folder above is reset there."""
    user = factories.UserFactory()
    folder = make_folder(users=[(user, "editor")])
    room = make_room(parent=folder)

    with django_capture_on_commit_callbacks(execute=True):
        folder.accesses.get(user=user).delete()

    reset = apply.yhub.return_value.reset_connections
    assert [call.args[0].id for call in reset.call_args_list] == [folder.id]
    assert room.id not in [call.args[0].id for call in reset.call_args_list]


def test_services_livekit_rooms_empty_room_does_not_call_livekit(
    apply, django_capture_on_commit_callbacks
):
    """Nobody in the room, nothing to ask LiveKit."""
    user = factories.UserFactory()
    folder = make_folder(users=[(user, "editor")])
    make_room(parent=folder)

    with django_capture_on_commit_callbacks(execute=True):
        folder.accesses.get(user=user).delete()

    assert calls(apply) == []


# The check itself


def test_services_livekit_rooms_recheck_returns_who_was_removed():
    """The identities removed from the room are reported."""
    user = factories.UserFactory()
    room = make_room()
    enter(room, user)

    with mock.patch.object(livekit_rooms, "_apply", return_value=set()):
        removed = livekit_rooms.recheck_room(room)

    assert removed == [str(user.sub)]


def test_services_livekit_rooms_failed_removal_leaves_the_person_listed():
    """If LiveKit could not remove someone, they are still in the room and still listed."""
    user = factories.UserFactory()
    room = make_room()
    enter(room, user)

    with mock.patch.object(livekit_rooms, "_apply", return_value={str(user.sub)}):
        removed = livekit_rooms.recheck_room(room)

    assert removed == []
    assert len(PresenceStore().participants(str(room.id))) == 1


def test_services_livekit_rooms_unknown_user_is_removed():
    """Someone whose user does not exist anymore has no right to be there."""
    room = make_room()
    PresenceStore().join(
        str(room.id),
        "sub-ghost",
        "PA_ghost",
        "Ghost",
        user_id="00000000-0000-0000-0000-000000000000",
    )

    with mock.patch.object(livekit_rooms, "_apply", return_value=set()) as apply:
        livekit_rooms.recheck_room(room)

    assert calls(apply) == [(str(room.id), ["sub-ghost"], {})]


@mock.patch.object(livekit_rooms, "_apply")
def test_services_livekit_rooms_recheck_does_nothing_without_livekit(apply):
    """Without a LiveKit server there is nobody to remove."""
    room = make_room()
    enter(room, factories.UserFactory())

    with mock.patch.object(
        livekit_rooms.livekit_tokens, "is_configured", return_value=False
    ):
        removed = livekit_rooms.recheck_room(room)

    assert removed == []
    apply.assert_not_called()


# The requests sent to LiveKit


def fake_livekit_api(remove_side_effect=None):
    """A LiveKit client recording what it is asked."""
    api = mock.MagicMock()
    api.room.remove_participant = mock.AsyncMock(side_effect=remove_side_effect)
    api.room.update_participant = mock.AsyncMock()
    api.aclose = mock.AsyncMock()
    return api


def test_services_livekit_rooms_apply_builds_the_requests():
    """Removals name the room and identity; updates carry the right to publish."""
    api = fake_livekit_api()

    with mock.patch.object(livekit_rooms, "LiveKitAPI", return_value=api):
        failed = livekit_rooms._apply(  # pylint: disable=protected-access
            "room-1", ["leaving"], {"speaker": True, "listener": False}
        )

    assert failed == set()
    api.room.remove_participant.assert_awaited_once_with(
        RoomParticipantIdentity(room="room-1", identity="leaving")
    )
    updates = {
        call.args[0].identity: call.args[0]
        for call in api.room.update_participant.await_args_list
    }
    assert updates["speaker"].room == "room-1"
    assert updates["speaker"].permission.can_publish is True
    assert updates["speaker"].permission.can_subscribe is True
    assert TrackSource.MICROPHONE in updates["speaker"].permission.can_publish_sources
    assert updates["listener"].permission.can_publish is False
    assert updates["listener"].permission.can_subscribe is True
    assert list(updates["listener"].permission.can_publish_sources) == []
    api.aclose.assert_awaited_once()


def test_services_livekit_rooms_apply_ignores_someone_already_gone():
    """A participant LiveKit does not know anymore is what we wanted: not a failure."""
    api = fake_livekit_api(
        remove_side_effect=TwirpError("not_found", "gone", status=404)
    )

    with mock.patch.object(livekit_rooms, "LiveKitAPI", return_value=api):
        failed = livekit_rooms._apply("room-1", ["leaving"], {})  # pylint: disable=protected-access

    assert failed == set()


def test_services_livekit_rooms_apply_reports_a_removal_that_failed():
    """Any other error is reported so that the person stays listed, and the rest goes on."""
    api = fake_livekit_api(remove_side_effect=RuntimeError("down"))

    with mock.patch.object(livekit_rooms, "LiveKitAPI", return_value=api):
        failed = livekit_rooms._apply(  # pylint: disable=protected-access
            "room-1", ["leaving"], {"speaker": True}
        )

    assert failed == {"leaving"}
    api.room.update_participant.assert_awaited_once()
    api.aclose.assert_awaited_once()


def test_services_livekit_rooms_apply_uses_the_internal_url_when_there_is_one(settings):
    """The backend can reach LiveKit at another address than the browsers."""
    settings.LIVEKIT_CONFIGURATION = {
        **settings.LIVEKIT_CONFIGURATION,
        "internal_url": "http://livekit:7880",
    }
    api = fake_livekit_api()

    with mock.patch.object(livekit_rooms, "LiveKitAPI", return_value=api) as client:
        livekit_rooms._apply("room-1", [], {})  # pylint: disable=protected-access

    assert client.call_args.kwargs["url"] == "http://livekit:7880"


# Who is in the rooms, according to LiveKit


def test_services_livekit_rooms_live_participants_reads_the_server():
    """The people of each room come from LiveKit, with the id we put in the token."""
    person = mock.MagicMock(identity="sub-1", attributes={"user_id": "u1"})
    person.name = "Ana"
    api = fake_livekit_api()
    api.room.list_participants = mock.AsyncMock(
        return_value=mock.MagicMock(participants=[person])
    )

    with mock.patch.object(livekit_rooms, "LiveKitAPI", return_value=api):
        result = livekit_rooms.live_participants(["room-1"])

    assert result == {"room-1": [{"identity": "sub-1", "name": "Ana", "user_id": "u1"}]}
    api.aclose.assert_awaited_once()


def test_services_livekit_rooms_live_participants_gives_none_when_unreachable():
    """When LiveKit cannot be reached the callers fall back on what they recorded."""
    api = fake_livekit_api()
    api.room.list_participants = mock.AsyncMock(side_effect=RuntimeError("down"))

    with mock.patch.object(livekit_rooms, "LiveKitAPI", return_value=api):
        assert livekit_rooms.live_participants(["room-1"]) is None
