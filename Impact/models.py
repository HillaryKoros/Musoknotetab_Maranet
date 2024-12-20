# from django.db import models
from django.contrib.gis.db import models 


# Create your models here.
# 1. Create a model named affected_population that has the following fields:
class AffectedPopulation(models.Model):
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
        verbose_name_plural = "AffectedPopulation"

# 2. Create a model named impacted_gdp that has the following fields:
class ImpactedGDP(models.Model):
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
        verbose_name_plural = "ImpactedGDP"


# 3. Create a model named affected_crops that has the following fields:
class AffectedCrops(models.Model):
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
        verbose_name_plural = "AffectedCrops"


# 4. Create a model named affected_roads that has the following fields:
class AffectedRoads(models.Model):
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
        verbose_name_plural = "AffectedRoads"


# 5. Create a model named displaced_population that has the following fields:
class DisplacedPopulation(models.Model):
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
        verbose_name_plural = "DisplacedPopulation"


# 6. Create a model named affected_livestock that has the following fields:
class AffectedLivestock(models.Model):
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
        verbose_name_plural = "AffectedLivestock"


# 7. Create a model named affected_grazingland that has the following fields:
class AffectedGrazingLand(models.Model):
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
        verbose_name_plural = "AffectedGrazingLand"