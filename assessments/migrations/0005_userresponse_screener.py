# Generated by Django 3.0.8 on 2020-07-12 14:36

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('assessments', '0004_userresponse_date'),
    ]

    operations = [
        migrations.AddField(
            model_name='userresponse',
            name='Screener',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='assessments.Screener'),
        ),
    ]
