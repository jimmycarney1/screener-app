from django.shortcuts import render

def index(request):
    return render(request, 'assessments_ui/index.html')