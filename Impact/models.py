# from django.db import models
from django.contrib.gis.db import models 
# Create your models here.

# Create a model called Impacts that has the following fields:
class Impacts(models.Model):
    name = models.CharField(max_length=100)
    location = models.PointField(srid=4326) 

    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name_plural = "Impacts"


class Crops(models.Model):
    gid_0 = models.CharField(max_length=80)
    name_0 = models.CharField(max_length=80)
    name_1 = models.CharField(max_length=80)
    engtype_1 = models.CharField(max_length=80)
    lack_cc = models.FloatField()
    cod = models.CharField(max_length=80)
    stock = models.FloatField()
    flood_tot = models.FloatField()
    flood_perc = models.FloatField()
    geom = models.MultiPolygonField(srid=4326)

    def __unicode__(self):
        return self.name_1
    
    class Meta:
        verbose_name_plural = "Crops"