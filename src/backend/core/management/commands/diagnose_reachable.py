"""Explain why somebody does, or does not, appear as "reachable" in their spaces."""

from django.core.management.base import BaseCommand, CommandError

from core import models
from core.services import livekit_rooms, livekit_tokens
from core.services.livekit_presence import PresenceStore


class Command(BaseCommand):
    """Print, for a user, each condition needed to be shown as reachable."""

    help = "Show why a user appears (or not) as reachable. Usage: diagnose_reachable <email>"

    def add_arguments(self, parser):
        parser.add_argument("email")

    def handle(self, *args, **options):
        user = models.User.objects.filter(email__iexact=options["email"]).first()
        if user is None:
            raise CommandError(f"No user with the email {options['email']}")

        def line(ok, text):
            self.stdout.write(f"  [{'OK' if ok else 'NON'}] {text}")

        self.stdout.write(f"Utilisateur : {user.email} ({user.pk})")

        accepting = str(user.pk) in PresenceStore().reachable([user.pk])
        line(
            accepting,
            "interrupteur « Joignable » du menu de statut : "
            + ("activé" if accepting else "désactivé (il faut l'activer)"),
        )

        if not livekit_tokens.is_configured():
            line(False, "LiveKit n'est pas configuré sur ce serveur")
            online = None
        else:
            online = livekit_rooms.online_inboxes([user])
            if online is None:
                line(False, "LiveKit ne répond pas : impossible de savoir")
            else:
                line(
                    str(user.pk) in online,
                    "connecté à sa boîte de réception LiveKit en ce moment"
                    " et sa page a confirmé qu'elle peut recevoir"
                    " (il faut un onglet ouvert, avec l'interrupteur Joignable activé)",
                )
                listed = livekit_rooms.listed_inboxes([user])
                line(
                    listed is not None and str(user.pk) in listed,
                    "listé par LiveKit (sans confirmation de la page)",
                )

        favorites = models.DocumentFavorite.objects.filter(user=user).select_related(
            "document"
        )
        if not favorites:
            line(False, "aucun favori : il faut mettre l'espace en favori")
        for favorite in favorites:
            document = favorite.document
            self.stdout.write(
                f"  Favori : {document.title or document.pk} ({document.kind})"
            )
            if document.kind == "folder":
                line(
                    favorite.reachable,
                    "  interrupteur « Joignable » activé pour cet espace",
                )
