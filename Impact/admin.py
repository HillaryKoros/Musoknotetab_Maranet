from django.contrib import admin
from .models import Impacts 
# Register your models here.

#create a class called ImpactsAdmin that inherits from admin.ModelAdmin and has the following fields:

class ImpactsAdmin(admin.ModelAdmin):
    list_display = ('name', 'description' , 'location')


admin.site.register(Impacts, ImpactsAdmin)

