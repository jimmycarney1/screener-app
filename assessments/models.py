from django.db import models
from django.contrib.auth.models import User, Group

# Define a class for the Question table
from django.db.models import SET_NULL
from django.urls import reverse


class Question(models.Model):
    id = models.CharField(max_length=100, primary_key=True)
    domain = models.CharField(max_length=100)
    title = models.CharField(max_length=500)

    def __str__(self):
        return self.title


# Define a class for the Answer table
class Answer(models.Model):
    value = models.IntegerField()
    title = models.CharField(max_length=500)

    def __str__(self):
        return self.title


# Define a class for the Section table
class Section(models.Model):
    type = models.CharField(max_length=100)
    title = models.CharField(max_length=500)
    answers = models.ManyToManyField(Answer)
    questions = models.ManyToManyField(Question)

    def __str__(self):
        return self.title


# Define a class for the Content table
class Content(models.Model):
    display_name = models.CharField(max_length=100)
    sections = models.ManyToManyField(Section)

    def __str__(self):
        return self.display_name


# Define a class for the Screener table
class Screener(models.Model):
    id = models.AutoField(primary_key=True)
    short_name = models.CharField(max_length=100)
    full_name = models.CharField(max_length=100, unique=True)
    disorder = models.CharField(max_length=100)
    content = models.OneToOneField(Content, on_delete=models.CASCADE)

    def __str__(self):
        return self.full_name

    def get_absolute_url(self):
        """Returns the url to access a particular instance of the model."""
        return reverse('screener-documentation', args=[str(self.id)])


# Define a class for the UserAnswer table
# This will be recorded based on user recordings
class UserAnswer(models.Model):
    value = models.IntegerField()
    question_id = models.ForeignKey(Question, on_delete=models.CASCADE)


# Define a class for the UserResponse table
class UserResponse(models.Model):
    answers = models.ManyToManyField(UserAnswer)
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    date = models.DateField(auto_created=True)
    screener = models.ForeignKey(Screener, on_delete=SET_NULL, null=True, blank=True)

    def get_absolute_url(self):
        """Returns the url to access a particular instance of the model."""
        return reverse('user-responses', args=[str(self.id)])

    def __str__(self):
        return str(self.user) + ": " + str(self.date)
