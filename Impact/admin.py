from django.contrib import admin
from .models import AffectedGrazingLand, AffectedPopulation, ImpactedGDP, AffectedCrops,AffectedLivestock,AffectedRoads,DisplacedPopulation
from leaflet.admin import LeafletGeoAdmin


# Register your models here.

#create a class called AffectedPopulationAdmin that inherits from admin.ModelAdmin and has the following fields:
class AffectedPopulationAdmin(LeafletGeoAdmin):
    list_display = ('name_1', 'cod')

#create a class called ImpactedGDPAdmin that inherits from admin.ModelAdmin and has the following fields:
class ImpactedGDPAdmin(LeafletGeoAdmin):
    list_display = ('name_1', 'cod')

#create a class called AffectedCropsAdmin that inherits from admin.ModelAdmin and has the following fields:
class AffectedCropsAdmin(LeafletGeoAdmin):
    list_display = ('name_1', 'cod')

#create a class called AffectedGrazingLandAdmin that inherits from admin.ModelAdmin and has the following fields:
class AffectedGrazingLandAdmin(LeafletGeoAdmin):
    list_display = ('name_1', 'cod')

# creatte  a class called affected_livestockAdmin that inherits from admin.ModelAdmin and has the following fields:
class AffectedLivestockAdmin(LeafletGeoAdmin):
    list_display = ('name_1', 'cod')

# creatte  a class called affected_roadsAdmin that inherits from admin.ModelAdmin and has the following fields:
class AffectedRoadsAdmin(LeafletGeoAdmin):
    list_display = ('name_1', 'cod')

#create a class called DisplacedPopulationAdmin that inherits from admin.ModelAdmin and has the following fields:
class DisplacedPopulationAdmin(LeafletGeoAdmin):
    list_display = ('name_1', 'cod')


# Register the models with the admin site
admin.site.register(AffectedPopulation, AffectedPopulationAdmin)
admin.site.register(ImpactedGDP, ImpactedGDPAdmin)
admin.site.register(AffectedCrops, AffectedCropsAdmin)
admin.site.register(AffectedGrazingLand, AffectedGrazingLandAdmin)
admin.site.register(AffectedLivestock, AffectedLivestockAdmin)
admin.site.register(AffectedRoads, AffectedRoadsAdmin)
admin.site.register(DisplacedPopulation, DisplacedPopulationAdmin)





