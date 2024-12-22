from django.urls import path
from .views import HomeView,MapView, affectedPop, affectedGDP, affectedCrops, affectedGrazingLand, affectedLivestock, affectedRoads, displacedPop

urlpatterns = [
    path('', HomeView.as_view(), name='home'),
    path('map/', MapView.as_view(), name='mapview'),
    path('affectedPop/', affectedPop, name='affectedPop'),
    path('affectedGDP/', affectedGDP, name='affectedGDP'),
    path('affectedCrops/', affectedCrops, name='affectedCrops'),
    path('affectedGrazingLand/', affectedGrazingLand, name='affectedGrazingLand'),
    path('affectedLivestock/', affectedLivestock, name='affectedLivestock'),
    path('affectedRoads/', affectedRoads, name='affectedRoads'),
    path('displacedPop/', displacedPop, name='displacedPop'),

]
