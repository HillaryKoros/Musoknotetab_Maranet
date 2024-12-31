from rest_framework_gis.serializers import GeoFeatureModelSerializer 

from Impact.models import AffectedPopulation, ImpactedGDP, AffectedCrops, AffectedRoads, DisplacedPopulation, AffectedLivestock, AffectedGrazingLand


class AffectedPopulationSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = AffectedPopulation
        geo_field = 'geom'
        fields = '__all__'


class ImpactedGDPSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = ImpactedGDP
        geo_field = 'geom'
        fields = '__all__'  


class AffectedCropsSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = AffectedCrops
        geo_field = 'geom'
        fields = '__all__'


class AffectedRoadsSerializer(GeoFeatureModelSerializer):    
    class Meta:
        model = AffectedRoads
        geo_field = 'geom'
        fields = '__all__'



class DisplacedPopulationSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = DisplacedPopulation
        geo_field = 'geom'
        fields = '__all__'


class AffectedLivestockSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = AffectedLivestock
        geo_field = 'geom'
        fields = '__all__'


class AffectedGrazingLandSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = AffectedGrazingLand
        geo_field = 'geom'
        fields = '__all__'



