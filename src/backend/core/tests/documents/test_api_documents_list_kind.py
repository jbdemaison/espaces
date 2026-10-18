"""Tests for filtering the list of documents by kind."""

import pytest
from rest_framework.test import APIClient

from core import factories
from core.choices import DocumentKindChoices

pytestmark = pytest.mark.django_db


def test_api_documents_list_filter_by_kind():
    """The list can be limited to folders and rooms."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)
    folder = factories.DocumentFactory(
        kind=DocumentKindChoices.FOLDER, users=[(user, "owner")]
    )
    room = factories.DocumentFactory(
        kind=DocumentKindChoices.ROOM, users=[(user, "owner")]
    )
    doc = factories.DocumentFactory(users=[(user, "owner")])

    response = client.get("/api/v1.0/documents/?kind=folder&kind=room")
    assert response.status_code == 200
    assert {r["id"] for r in response.json()["results"]} == {
        str(folder.id),
        str(room.id),
    }

    response = client.get("/api/v1.0/documents/?kind=document")
    assert {r["id"] for r in response.json()["results"]} == {str(doc.id)}


def test_api_documents_list_filter_by_unknown_kind():
    """An unknown kind is refused."""
    client = APIClient()
    client.force_login(factories.UserFactory())

    response = client.get("/api/v1.0/documents/?kind=nope")

    assert response.status_code == 400
