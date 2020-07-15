from datetime import datetime, date

from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.backends.utils import logger
from django.views.decorators.csrf import csrf_exempt

from .globals import BPDS_THRESHHOLDS, BPDS_ASSESSMENTS
from django.shortcuts import render
from rest_framework import viewsets, generics, status
from rest_framework.decorators import api_view, permission_classes

from .seralizers import ScreenerSerializer, UserResponseSerializer

from .models import Screener, UserResponse, Question, UserAnswer
from django.views import generic
from rest_framework.response import Response
from rest_framework_api_key.permissions import HasAPIKey

# Create your views here.

# Function for the main view
def index(request):
    # simply get and return the number of screeners
    screeners = Screener.objects.all().count()
    context = {'screeners': screeners}

    # Render the HTML template index.html with the data in the context variable
    return render(request, 'index.html', context=context)


# Generic List of Screeners
class ScreenerListView(LoginRequiredMixin, generic.ListView):
    model = Screener


# Generic detail page of Screeners
class ScreenerDetailView(LoginRequiredMixin, generic.DetailView):
    model = Screener


# Generic detail page of User details
class ResponsesByUserListView(LoginRequiredMixin, generic.ListView):
    model = UserResponse
    template_name = 'assessments/responses_by_user.html'

    def get_queryset(self):
        return UserResponse.objects.filter(user=self.request.user).order_by('date')


# Will return list of all screeners, in json
class ScreenerPortal(viewsets.ModelViewSet):

    queryset = Screener.objects.all()
    serializer_class = ScreenerSerializer


# will return just one screener, based on passed in pk
class ScreenerInstanceView(generics.RetrieveAPIView):
    """
    Returns a single screener. This is readonly
    """

    model = Screener
    serializer_class = ScreenerSerializer


# Function to recieve survey: update db and output results
@csrf_exempt
@api_view(['POST', 'GET'])
def receive_bds_survey(request):
    logger.error("HERE")
    # This will be a list of assessments for follow up tests
    return_list = []

    if request.method == 'POST':
        # dictionary to keep track of value for each domain
        request = request.data
        domains = {}
        user = None

        try:
            # TODO: Implemenet users and screener logic
            # TODO: Along with auth
            user = request.get('user')
            screener = request.get('screener')
        except Exception:
            logger.warning('No user recorded with survey')

        try:
            # create a record to add to the database
            record = UserResponse.objects.create(screener=screener, date=date.today())

            for answer in (request.get('answers')):
                question = Question.objects.get(id=answer.get('question_id'))

                user_answer = UserAnswer.objects.create(value=answer.get('value'), question_id=question)
                record.answers.add(user_answer)

                # Add up total value for each domain
                domain = question.domain
                domains[domain] = domains.get(domain, 0) + answer.get('value')

            # Save database
            record.save()
            # check each domain against the assessment and threshold lists
            for dom in domains:

                if domains.get(dom) >= BPDS_THRESHHOLDS.get(dom):
                    return_list.append(BPDS_ASSESSMENTS.get(dom))

            return Response({"results": list(set(return_list))}, status=status.HTTP_201_CREATED)

        except Exception:
            logger.exception("No response data")
            return Response({'Error': "Not correct format"}, status=status.HTTP_400_BAD_REQUEST)

    return Response({'Error': "Not correct format"}, status=status.HTTP_400_BAD_REQUEST)
