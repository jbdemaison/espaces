import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0037_documentfavorite_reachable"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="avatar_updated_at",
            field=models.DateTimeField(
                blank=True,
                editable=False,
                help_text="Set when the user has a profile picture.",
                null=True,
                verbose_name="profile picture updated on",
            ),
        ),
        migrations.CreateModel(
            name="UserAvatar",
            fields=[
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        primary_key=True,
                        related_name="avatar",
                        serialize=False,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                ("content_type", models.CharField(max_length=20)),
                ("data", models.BinaryField()),
            ],
            options={
                "verbose_name": "user avatar",
                "verbose_name_plural": "user avatars",
                "db_table": "impress_user_avatar",
            },
        ),
    ]
