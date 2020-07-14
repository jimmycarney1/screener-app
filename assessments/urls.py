from django.urls import include, path, re_path
from . import views
from rest_framework import routers

router = routers.DefaultRouter()
router.register(r'screeners', views.ScreenerPortal)

urlpatterns = [
    path('', views.index, name='index'),
    path('screener/', views.ScreenerListView.as_view(), name='screener'),
    path('screener/<int:pk>', views.ScreenerDetailView.as_view(), name='screener-documentation'),

]
urlpatterns += [
    path('myresponses/', views.ResponsesByUserListView.as_view(), name='user-responses'),
]


urlpatterns += [
    path('api/', include(router.urls)),
    path('api/api-auth/', include('rest_framework.urls', namespace='rest_framework')),
    re_path(r'^api/screeners/(?P<pk>[\d]+)/$', views.ScreenerInstanceView.as_view(), name='Screener-api'),
    path(r'api/bpds', views.receive_bds_survey, name='record-bpds'),
    path(r'apis/bpds', views.dummy_test, name='save-bpds')
]
