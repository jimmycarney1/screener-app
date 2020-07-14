from django.contrib import admin
from .models import Question, Answer, Section, Screener, Content, UserAnswer, UserResponse


# Register your models here.
admin.site.register(Question)
admin.site.register(Answer)
admin.site.register(Section)
admin.site.register(Content)
admin.site.register(Screener)
admin.site.register(UserAnswer)
admin.site.register(UserResponse)