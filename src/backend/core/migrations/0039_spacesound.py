import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0038_user_avatar"),
    ]

    operations = [
        migrations.CreateModel(
            name="SpaceSound",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        help_text="primary key for the record as UUID",
                        primary_key=True,
                        serialize=False,
                        verbose_name="id",
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(
                        auto_now_add=True,
                        help_text="date and time at which a record was created",
                        verbose_name="created on",
                    ),
                ),
                (
                    "updated_at",
                    models.DateTimeField(
                        auto_now=True,
                        help_text="date and time at which a record was last updated",
                        verbose_name="updated on",
                    ),
                ),
                ("name", models.CharField(max_length=40, verbose_name="name")),
                (
                    "emoji",
                    models.CharField(default="🔊", max_length=16, verbose_name="emoji"),
                ),
                ("content_type", models.CharField(max_length=20)),
                ("data", models.BinaryField()),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "space",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sounds",
                        to="core.document",
                    ),
                ),
            ],
            options={
                "verbose_name": "space sound",
                "verbose_name_plural": "space sounds",
                "db_table": "impress_space_sound",
                "ordering": ("created_at",),
            },
        ),
    ]
