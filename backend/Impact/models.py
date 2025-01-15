
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


# 8. Create a model named SectorData that has the following fields:
class SectorData(models.Model):
    sec_code = models.BigIntegerField()
    sec_name = models.CharField(max_length=80)
    basin = models.CharField(max_length=80)
    domain = models.CharField(max_length=80)
    admin_b_l1 = models.CharField(max_length=80)
    admin_b_l2 = models.CharField(max_length=80, null=True)
    admin_b_l3 = models.CharField(max_length=80, null=True)
    sec_rs = models.CharField(max_length=80)
    area = models.FloatField(null=False)
    lat = models.FloatField(null=False)
    lon = models.FloatField(null=False)
    q_thr1 = models.FloatField(null=False)
    q_thr2 = models.FloatField(null=False)
    q_thr3 = models.FloatField(null=False)
    cat = models.FloatField(null=True)
    # id = models.BigIntegerField(primary_key=True)
    geom = models.PointField()

    def __unicode__(self):
        return self.sec_name

    class Meta:
        verbose_name_plural = "SectorData"


# class TimeSeriesData(models.Model):
#     sector = models.ForeignKey(SectorData, on_delete=models.CASCADE, related_name="time_series")
#     timestamp = models.DateTimeField()
#     value = models.FloatField()  # The time series value (e.g., discharge, etc.)
#     source = models.CharField(max_length=50)  # E.g., "gfs", "icon", etc.

#     class Meta:
#         verbose_name_plural = "TimeSeriesData"
#         unique_together = ('sector', 'timestamp', 'source')


# # 9.  Create a model named waterbody
# class WaterBody(models.Model):
#     fid = models.FloatField()
#     af_wtr_id = models.FloatField()
#     sqkm = models.FloatField()
#     name_of_wa = models.CharField(max_length=254, null=True, blank=True)  # Add both null and blank
#     type_of_wa = models.CharField(max_length=254)
#     shape_area = models.FloatField()
#     shape_len = models.FloatField()
#     geom = models.MultiPolygonField(srid=4326)


#     def __unicode__(self):
#         return self.name_of_wa

#     class Meta:
#         verbose_name_plural = "WaterBody"

