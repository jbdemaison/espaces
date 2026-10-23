from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0036_document_kind_emoji"),
    ]

    operations = [
        migrations.AddField(
            model_name="documentfavorite",
            name="reachable",
            field=models.BooleanField(default=False, verbose_name="reachable"),
        ),
    ]
