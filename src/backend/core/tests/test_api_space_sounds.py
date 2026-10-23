"""Tests for the sounds of a space."""

import io
import wave

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.api import sounds

pytestmark = pytest.mark.django_db


def wav(seconds=0.2):
    """A small real WAV file."""
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(8000)
        out.writeframes(b"\x00\x00" * int(8000 * seconds))
    buffer.seek(0)
    buffer.name = "beep.wav"
    return buffer


def logged(user):
    client = APIClient()
    client.force_login(user)
    return client


def setup_space(role="editor"):
    user = factories.UserFactory()
    space = factories.DocumentFactory(kind="folder", link_reach="restricted")
    room = factories.DocumentFactory(kind="room", parent=space, link_reach="restricted")
    factories.UserDocumentAccessFactory(user=user, document=space, role=role)
    return user, space, room


def url(document, sound=None):
    base = f"/api/v1.0/documents/{document.id}/sounds/"
    return f"{base}{sound}/" if sound else base


def add(client, document, name="Bravo", emoji="👏", file=None):
    return client.post(
        url(document),
        {"name": name, "emoji": emoji, "file": file or wav()},
        format="multipart",
    )


def test_sounds_require_login():
    """Anonymous visitors get nothing."""
    space = factories.DocumentFactory(kind="folder")
    assert APIClient().get(url(space)).status_code == 401


def test_editor_adds_and_everybody_in_the_space_plays():
    """A sound added from a room is shared by the whole space."""
    editor, space, room = setup_space("editor")
    created = add(logged(editor), room)
    assert created.status_code == 201, created.json()
    sound_id = created.json()["id"]

    reader = factories.UserFactory()
    factories.UserDocumentAccessFactory(user=reader, document=space, role="reader")
    listing = logged(reader).get(url(room))
    assert listing.status_code == 200
    assert [s["name"] for s in listing.json()["results"]] == ["Bravo"]
    assert listing.json()["results"][0]["emoji"] == "👏"
    assert listing.json()["can_add"] is False

    audio = logged(reader).get(url(room, sound_id))
    assert audio.status_code == 200
    assert audio["Content-Type"] == "audio/wav"
    assert audio["X-Content-Type-Options"] == "nosniff"


def test_reader_cannot_add():
    """Only people who can edit the space add sounds."""
    reader, _space, room = setup_space("reader")
    assert add(logged(reader), room).status_code == 403


def test_stranger_finds_nothing():
    """Somebody with no access to the space is told it does not exist."""
    _user, space, room = setup_space()
    stranger = logged(factories.UserFactory())
    assert stranger.get(url(room)).status_code == 404
    assert add(stranger, space).status_code == 404


def test_only_spaces_and_rooms_have_sounds():
    """A plain document has no sounds."""
    user = factories.UserFactory()
    doc = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(user=user, document=doc, role="owner")
    assert logged(user).get(url(doc)).status_code == 404


def test_rejects_what_is_not_a_sound():
    """The real content is checked, not the name."""
    user, _space, room = setup_space()
    fake = io.BytesIO(b"<html>not a sound</html>")
    fake.name = "beep.mp3"
    assert add(logged(user), room, file=fake).status_code == 400


def test_rejects_a_sound_longer_than_five_seconds():
    """The part kept is 5 seconds at most, checked here too."""
    user, _space, room = setup_space()
    assert add(logged(user), room, file=wav(5.0)).status_code == 201
    assert add(logged(user), room, file=wav(6.0)).status_code == 400


def test_rejects_other_formats():
    """Only WAV is kept, whatever the content."""
    user, _space, room = setup_space()
    mp3 = io.BytesIO(b"ID3\x03\x00\x00\x00\x00\x00\x00" + b"\xff\xfb\x90\x00" * 400)
    mp3.name = "beep.mp3"
    assert add(logged(user), room, file=mp3).status_code == 400


def test_rejects_big_files_and_bad_names():
    """Size and name are limited."""
    user, _space, room = setup_space()
    big = io.BytesIO(b"RIFF" + b"0" * (301 * 1024))
    big.name = "big.wav"
    assert add(logged(user), room, file=big).status_code == 400
    assert add(logged(user), room, name="").status_code == 400
    assert add(logged(user), room, name="x" * 41).status_code == 400
    assert add(logged(user), room, emoji="e" * 17).status_code == 400


def test_limit_of_sounds_per_space(settings):
    """A space cannot hold more than a few sounds."""
    user, space, room = setup_space()
    for index in range(sounds.SOUND_MAX_PER_SPACE):
        models.SpaceSound.objects.create(
            space=space, name=f"s{index}", content_type="audio/wav", data=b"x"
        )
    assert add(logged(user), room).status_code == 400


def test_delete_by_manager_or_author_only():
    """The author and the people who edit the space may remove a sound."""
    author, space, room = setup_space("editor")
    sound_id = add(logged(author), room).json()["id"]

    other = factories.UserFactory()
    factories.UserDocumentAccessFactory(user=other, document=space, role="reader")
    assert logged(other).delete(url(room, sound_id)).status_code == 403

    assert logged(author).delete(url(room, sound_id)).status_code == 204
    assert models.SpaceSound.objects.count() == 0


def test_sound_of_another_space_is_not_reachable():
    """The address of a sound only works in its own space."""
    user, _space, room = setup_space()
    sound_id = add(logged(user), room).json()["id"]
    other_user, _other_space, other_room = setup_space()
    assert logged(other_user).get(url(other_room, sound_id)).status_code == 404
