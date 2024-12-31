# from django.urls import path
# from .views import HomeView,MapView, affectedPop, affectedGDP, affectedCrops, affectedGrazingLand, affectedLivestock, affectedRoads, displacedPop
from rest_framework.routers import DefaultRouter

from .views import AffectedPopulationViewSet, ImpactedGDPViewSet, AffectedCropsViewSet, AffectedRoadsViewSet, DisplacedPopulationViewSet, AffectedLivestockViewSet, AffectedGrazingLandViewSet

router = DefaultRouter()


router.register(r'affectedPop', AffectedPopulationViewSet)
router.register(r'affectedGDP', ImpactedGDPViewSet)
router.register(r'affectedCrops', AffectedCropsViewSet)
router.register(r'affectedRoads', AffectedRoadsViewSet)
router.register(r'displacedPop', DisplacedPopulationViewSet)
router.register(r'affectedLivestock', AffectedLivestockViewSet)
router.register(r'affectedGrazingLand', AffectedGrazingLandViewSet)




urlpatterns = router.urls

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

