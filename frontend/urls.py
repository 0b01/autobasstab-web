from django.urls import path
from django.views.generic import TemplateView, RedirectView
from . import views

urlpatterns = [
    path('', views.index),
    path('model.json', RedirectView.as_view(url='http://rickyhan.com/static/crepe_model_full/model.json', permanent=True)),
]
