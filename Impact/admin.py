from django.contrib import admin
from .models import Impacts ,Crops
from leaflet.admin import LeafletGeoAdmin
# Register your models here.

#create a class called ImpactsAdmin that inherits from admin.ModelAdmin and has the following fields:

class ImpactsAdmin(LeafletGeoAdmin):
    list_display = ('name', 'location')
#create a class called CropsAdmin that inherits from admin.ModelAdmin and has the following fields:
class CropsAdmin(LeafletGeoAdmin):
    list_display = ('name_1', 'cod')


admin.site.register(Impacts, ImpactsAdmin)
admin.site.register(Crops, CropsAdmin)



