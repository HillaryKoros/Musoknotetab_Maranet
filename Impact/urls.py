# from django.urls import path
# from .views import HomeView,MapView, affectedPop, affectedGDP, affectedCrops, affectedGrazingLand, affectedLivestock, affectedRoads, displacedPop
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
    path('api/', include(router.urls)),  # Include router URLs under `/api/`
]


# urlpatterns = [
#     path('', HomeView.as_view(), name='home'),
#     path('map/', MapView.as_view(), name='mapview'),
#     path('affectedPop/', affectedPop, name='affectedPop'),
#     path('affectedGDP/', affectedGDP, name='affectedGDP'),
#     path('affectedCrops/', affectedCrops, name='affectedCrops'),
#     path('affectedGrazingLand/', affectedGrazingLand, name='affectedGrazingLand'),
#     path('affectedLivestock/', affectedLivestock, name='affectedLivestock'),
#     path('affectedRoads/', affectedRoads, name='affectedRoads'),
#     path('displacedPop/', displacedPop, name='displacedPop'),

# ]

