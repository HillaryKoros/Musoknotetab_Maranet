from django.contrib import admin
from .models import Impacts 
from leaflet.admin import LeafletGeoAdmin
# Register your models here.

#create a class called ImpactsAdmin that inherits from admin.ModelAdmin and has the following fields:

class ImpactsAdmin(LeafletGeoAdmin):
    list_display = ('name', 'location')


admin.site.register(Impacts, ImpactsAdmin)

