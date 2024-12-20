from django.contrib import admin
from leaflet.admin import LeafletGeoAdmin
from .models import (
    AffectedGrazingLand, AffectedPopulation, ImpactedGDP, AffectedCrops,
    AffectedLivestock, AffectedRoads, DisplacedPopulation
)

class BaseImpactAdmin(LeafletGeoAdmin):
    list_display = (
        'gid_0',
        'name_0', 
        'name_1',
        'engtype_1',
        'lack_cc',
        'cod',
        'stock',
        'flood_tot',
        'flood_perc'
    )
    search_fields = ('name_0', 'name_1', 'cod')
    list_filter = ('name_0', 'engtype_1')
    
    # Leaflet settings
    settings_overrides = {
        'DEFAULT_CENTER': (0.0, 36.0),  # Centered on East Africa
        'DEFAULT_ZOOM': 4,
        'MIN_ZOOM': 3,
        'MAX_ZOOM': 18,
    }

@admin.register(AffectedPopulation)
class AffectedPopulationAdmin(BaseImpactAdmin):
    pass

@admin.register(ImpactedGDP)
class ImpactedGDPAdmin(BaseImpactAdmin):
    pass

@admin.register(AffectedCrops)
class AffectedCropsAdmin(BaseImpactAdmin):
    pass

@admin.register(AffectedGrazingLand)
class AffectedGrazingLandAdmin(BaseImpactAdmin):
    pass

@admin.register(AffectedLivestock)
class AffectedLivestockAdmin(BaseImpactAdmin):
    pass

@admin.register(AffectedRoads)
class AffectedRoadsAdmin(BaseImpactAdmin):
    pass

@admin.register(DisplacedPopulation)
class DisplacedPopulationAdmin(BaseImpactAdmin):
    pass