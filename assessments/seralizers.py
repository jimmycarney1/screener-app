from rest_framework import serializers
from .models import Screener, Question, Answer, Section, Content, UserResponse, UserAnswer
from django.contrib.auth.models import User


class CreateUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'password')
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = User.objects.create_user(validated_data['username'],
                                        None,
                                        validated_data['password'])
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username')


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ('id', 'title')


class QuestionIDSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ('id')


class AnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Answer
        fields = ('value', 'title')


class SectionSerializer(serializers.ModelSerializer):
    answers = AnswerSerializer(many=True, required=False, read_only=True)
    questions = QuestionSerializer(many=True, required=False, read_only=True)

    class Meta:
        model = Section
        fields = ('type', 'title', 'answers', 'questions')


class ContentSerializer(serializers.ModelSerializer):
    sections = SectionSerializer(many=True, required=False, read_only=True)

    class Meta:
        model = Content
        fields = ('display_name', 'sections')


class ScreenerSerializer(serializers.ModelSerializer):
    content = ContentSerializer(required=False, read_only=True)

    class Meta:
        model = Screener
        fields = ('short_name', 'full_name', 'disorder', 'content')


class UserAnswerSerializer(serializers.ModelSerializer):
    question = QuestionIDSerializer(required=True)

    class Meta:
        model = UserAnswer
        fields = ('question', 'value')


class UserResponseSerializer(serializers.ModelSerializer):
    answers = UserAnswerSerializer(many=True, required=True, read_only=False)
    screener = ScreenerSerializer(required=False)

    class Meta:
        model = UserResponse
        fields = ('user', 'date', 'answers', 'screener', 'user')
