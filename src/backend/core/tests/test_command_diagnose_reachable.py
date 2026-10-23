"""Tests for the command explaining why somebody is not shown as reachable."""

from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError

import pytest

from core import factories, models
from core.services.livekit_presence import PresenceStore

pytestmark = pytest.mark.django_db


def test_diagnose_reachable_lists_each_condition():
    """The switch, the connection and the favorite are each reported."""
    user = factories.UserFactory(email="alice@example.com")
    space = factories.DocumentFactory(kind="folder")
    models.DocumentFavorite.objects.create(user=user, document=space, reachable=True)
    PresenceStore().set_reachable(user.pk, True)

    out = StringIO()
    call_command("diagnose_reachable", "ALICE@example.com", stdout=out)

    text = out.getvalue()
    assert "[OK] interrupteur « Joignable » du menu de statut : activé" in text
    assert "LiveKit" in text
    assert "[OK]   interrupteur" in text


def test_diagnose_reachable_unknown_user():
    """An unknown email is an error."""
    with pytest.raises(CommandError):
        call_command("diagnose_reachable", "nobody@example.com")
