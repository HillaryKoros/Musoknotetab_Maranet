from django.shortcuts import render
from django.views.generic import TemplateView
from django.core import serializers
from django.http import HttpResponse
from .models import AffectedPopulation, ImpactedGDP, AffectedCrops, AffectedGrazingLand, AffectedLivestock, AffectedRoads, DisplacedPopulation
# Create your views here.

#
class HomeView(TemplateView):
    template_name = 'home.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Flood Watch System'
        return context


def affectedPop(request):
    affectedPop = AffectedPopulation.objects.all()
    affectedPop = serializers.serialize('geojson', affectedPop)
    return HttpResponse(affectedPop, content_type='json')

def affectedGDP(request):
    affectedGDP = ImpactedGDP.objects.all()
    affectedGDP = serializers.serialize('geojson', affectedGDP)
    return HttpResponse(affectedGDP, content_type='json')

def affectedCrops(request):
    affectedCrops = AffectedCrops.objects.all()
    affectedCrops = serializers.serialize('geojson', affectedCrops)
    return HttpResponse(affectedCrops, content_type='json')

def affectedGrazingLand(request):
    affectedGrazingLand = AffectedGrazingLand.objects.all()
    affectedGrazingLand = serializers.serialize('geojson', affectedGrazingLand)
    return HttpResponse(affectedGrazingLand, content_type='json')

def affectedLivestock(request): 
    affectedLivestock = AffectedLivestock.objects.all()
    affectedLivestock = serializers.serialize('geojson', affectedLivestock)
    return HttpResponse(affectedLivestock, content_type='json')

def affectedRoads(request):
    affectedRoads = AffectedRoads.objects.all()
    affectedRoads = serializers.serialize('geojson', affectedRoads)
    return HttpResponse(affectedRoads, content_type='json') 

def displacedPop(request):
    displacedPop = DisplacedPopulation.objects.all()
    displacedPop = serializers.serialize('geojson', displacedPop)
    return HttpResponse(displacedPop, content_type='json')


