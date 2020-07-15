# Generated by Django 3.0.8 on 2020-07-15 01:46

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Answer',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('value', models.IntegerField()),
                ('title', models.CharField(max_length=500)),
            ],
        ),
        migrations.CreateModel(
            name='Content',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('display_name', models.CharField(max_length=100)),
            ],
        ),
        migrations.CreateModel(
            name='Question',
            fields=[
                ('id', models.CharField(max_length=100, primary_key=True, serialize=False)),
                ('domain', models.CharField(max_length=100)),
                ('title', models.CharField(max_length=500)),
            ],
        ),
        migrations.CreateModel(
            name='Screener',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('short_name', models.CharField(max_length=100)),
                ('full_name', models.CharField(max_length=100, unique=True)),
                ('disorder', models.CharField(max_length=100)),
                ('content', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, to='assessments.Content')),
            ],
        ),
        migrations.CreateModel(
            name='UserAnswer',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('value', models.IntegerField()),
                ('question_id', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='assessments.Question')),
            ],
        ),
        migrations.CreateModel(
            name='UserResponse',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(auto_created=True)),
                ('answers', models.ManyToManyField(to='assessments.UserAnswer')),
                ('screener', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='assessments.Screener')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='Section',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type', models.CharField(max_length=100)),
                ('title', models.CharField(max_length=500)),
                ('answers', models.ManyToManyField(to='assessments.Answer')),
                ('questions', models.ManyToManyField(to='assessments.Question')),
            ],
        ),
        migrations.AddField(
            model_name='content',
            name='sections',
            field=models.ManyToManyField(to='assessments.Section'),
        ),
    ]
