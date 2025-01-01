from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AffectedPopulationViewSet,
    ImpactedGDPViewSet,
    AffectedCropsViewSet,
    AffectedRoadsViewSet,
    DisplacedPopulationViewSet,
    AffectedLivestockViewSet,
    AffectedGrazingLandViewSet,
)

# Create a router and register viewsets
router = DefaultRouter()
router.register(r'affectedPop', AffectedPopulationViewSet, basename='affectedPop')
router.register(r'affectedGDP', ImpactedGDPViewSet, basename='affectedGDP')
router.register(r'affectedCrops', AffectedCropsViewSet, basename='affectedCrops')
router.register(r'affectedRoads', AffectedRoadsViewSet, basename='affectedRoads')
router.register(r'displacedPop', DisplacedPopulationViewSet, basename='displacedPop')
router.register(r'affectedLivestock', AffectedLivestockViewSet, basename='affectedLivestock')
router.register(r'affectedGrazingLand', AffectedGrazingLandViewSet, basename='affectedGrazingLand')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include(router.urls)),  # Include router URLs under `/api/`
]
