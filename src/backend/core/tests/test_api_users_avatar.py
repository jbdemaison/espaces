"""Tests for the profile picture of users."""

import io

from django.utils import timezone

import pytest
from PIL import Image
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db


def make_image(fmt="PNG", size=(32, 32)):
    """A small real image."""
    buffer = io.BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(buffer, format=fmt)
    buffer.seek(0)
    buffer.name = f"photo.{fmt.lower()}"
    return buffer


def logged(user=None):
    client = APIClient()
    client.force_login(user or factories.UserFactory())
    return client


def test_avatar_upload_requires_login():
    """Anonymous visitors cannot set a picture."""
    response = APIClient().put(
        "/api/v1.0/users/me/avatar/", {"image": make_image()}, format="multipart"
    )
    assert response.status_code == 401


@pytest.mark.parametrize("fmt", ["PNG", "JPEG", "WEBP"])
def test_avatar_upload_and_read_back(fmt):
    """A picture is stored, announced with a version, and served to other users."""
    user = factories.UserFactory()
    response = logged(user).put(
        "/api/v1.0/users/me/avatar/", {"image": make_image(fmt)}, format="multipart"
    )
    assert response.status_code == 200, response.json()
    assert isinstance(response.json()["avatar_version"], int)

    me = logged(user).get("/api/v1.0/users/me/")
    assert me.json()["avatar_version"] == response.json()["avatar_version"]

    other_user = factories.UserFactory()
    space = factories.DocumentFactory(kind="folder")
    factories.UserDocumentAccessFactory(user=user, document=space)
    factories.UserDocumentAccessFactory(user=other_user, document=space)
    other = logged(other_user)
    image = other.get(f"/api/v1.0/users/{user.id}/avatar/")
    assert image.status_code == 200
    assert image["Content-Type"] == f"image/{fmt.lower()}"
    assert image["X-Content-Type-Options"] == "nosniff"
    assert "default-src 'none'" in image["Content-Security-Policy"]
    assert Image.open(io.BytesIO(image.content)).size == (32, 32)


def test_avatar_replace_keeps_one_picture():
    """Uploading again replaces the picture."""
    user = factories.UserFactory()
    client = logged(user)
    client.put(
        "/api/v1.0/users/me/avatar/", {"image": make_image()}, format="multipart"
    )
    client.put(
        "/api/v1.0/users/me/avatar/", {"image": make_image("JPEG")}, format="multipart"
    )
    assert models.UserAvatar.objects.filter(user=user).count() == 1
    assert models.UserAvatar.objects.get(user=user).content_type == "image/jpeg"


def test_avatar_rejects_something_that_is_not_an_image():
    """The content decides, not the name of the file."""
    fake = io.BytesIO(b"<html><script>alert(1)</script></html>")
    fake.name = "photo.png"
    response = logged().put(
        "/api/v1.0/users/me/avatar/", {"image": fake}, format="multipart"
    )
    assert response.status_code == 400


def test_avatar_rejects_big_files():
    """A picture is small once cropped: huge uploads are refused."""
    big = io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"0" * (400 * 1024))
    big.name = "photo.png"
    response = logged().put(
        "/api/v1.0/users/me/avatar/", {"image": big}, format="multipart"
    )
    assert response.status_code == 400


def test_avatar_requires_a_file():
    """No file, no picture."""
    response = logged().put("/api/v1.0/users/me/avatar/", {}, format="multipart")
    assert response.status_code == 400


def test_avatar_delete():
    """The picture can be removed: the initials come back."""
    user = factories.UserFactory()
    user.avatar_updated_at = timezone.now()
    user.save()
    models.UserAvatar.objects.create(user=user, content_type="image/png", data=b"x")

    response = logged(user).delete("/api/v1.0/users/me/avatar/")

    assert response.status_code == 204
    user.refresh_from_db()
    assert user.avatar_updated_at is None
    assert not models.UserAvatar.objects.filter(user=user).exists()
    assert logged().get(f"/api/v1.0/users/{user.id}/avatar/").status_code == 404


def test_avatar_unknown_user_or_bad_id():
    """Nothing to show: 404, never an error."""
    client = logged()
    assert (
        client.get(f"/api/v1.0/users/{factories.UserFactory().id}/avatar/").status_code
        == 404
    )
    assert client.get("/api/v1.0/users/not-an-id/avatar/").status_code == 404


def test_avatar_read_requires_login():
    """Pictures are only shown to logged-in people."""
    user = factories.UserFactory()
    models.UserAvatar.objects.create(user=user, content_type="image/png", data=b"x")
    assert APIClient().get(f"/api/v1.0/users/{user.id}/avatar/").status_code == 401


def test_avatar_hidden_from_people_who_share_nothing():
    """Somebody who works with nobody around that user gets a 404."""
    user = factories.UserFactory()
    logged(user).put(
        "/api/v1.0/users/me/avatar/", {"image": make_image()}, format="multipart"
    )
    assert logged().get(f"/api/v1.0/users/{user.id}/avatar/").status_code == 404
    assert logged(user).get(f"/api/v1.0/users/{user.id}/avatar/").status_code == 200
