# Generated by Django 3.0.8 on 2020-07-12 05:25

from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('assessments', '0003_auto_20200712_0441'),
    ]

    operations = [
        migrations.AddField(
            model_name='userresponse',
            name='date',
            field=models.DateField(auto_created=True),
            preserve_default=False,
        ),
    ]
