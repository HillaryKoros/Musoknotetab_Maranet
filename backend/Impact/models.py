
# from django.db import models
from django.contrib.gis.db import models 
from django.db import models as django_models

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


# 9. timeseries model
class SectorForecast(models.Model):
    sector = models.ForeignKey(SectorData, on_delete=models.CASCADE)
    model_type = models.CharField(max_length=10, choices=[('GFS', 'GFS'), ('ICON', 'ICON')])
    time_point = models.DateTimeField()
    forecast_value = models.FloatField(null=True)  

    class Meta:
        verbose_name_plural = "SectorForecast"
        indexes = [
            models.Index(fields=['sector', 'model_type', 'time_point']),  
        ]

    def __unicode__(self):
        return f"{self.sector.sec_name} - {self.model_type} - {self.time_point}"
    


# 10. create a model named waterbodies

class WaterBodies(models.Model):
    fid = models.FloatField()
    af_wtr_id = models.FloatField()
    sqkm = models.FloatField()
    name_of_wa = models.CharField(max_length=254,blank=True,null=True)
    type_of_wa = models.CharField(max_length=254,blank=True,null=True)
    shape_area = models.FloatField()
    shape_len = models.FloatField()
    geom = models.MultiPolygonField(srid=4326)

    def __unicode__(self):
        return self.name_of_wa

    class Meta:
        verbose_name_plural = "WaterBodies"



class RiverSection(models.Model):
    section_name = models.CharField(max_length=100)
    time_restart = models.DateTimeField()
    time_run = models.DateTimeField()
    time_start = models.DateTimeField()
    time_series_discharge_simulated_gfs = models.TextField()
    time_series_discharge_simulated_icon = models.TextField()
    time_period = models.TextField()
    sec_code = models.IntegerField()
    sec_name = models.CharField(max_length=100)
    basin = models.CharField(max_length=50)
    domain = models.CharField(max_length=50)
    area = models.FloatField()
    latitude = models.FloatField()
    longitude = models.FloatField()
    q_thr1 = models.FloatField()
    q_thr2 = models.FloatField()
    q_thr3 = models.FloatField()
    category = models.CharField(max_length=50, null=True, blank=True)
    geometry = models.PointField(srid=4326)

    def __str__(self):
        return self.section_name

    
    class Meta:
        verbose_name_plural = "RiverSections"
    


# 11. Create a model named GhaAdmin1 that has the following fields:
class GhaAdmin1(models.Model):
    objectid = models.IntegerField()
    g2008_0_field = models.FloatField()
    g2008_0_id = models.FloatField()
    adm0_code = models.FloatField()
    adm0_name = models.CharField(max_length=100,null=True,blank=True)
    continent = models.CharField(max_length=150,null=True,blank=True)
    region = models.CharField(max_length=150,null=True,blank=True)  
    shape_leng = models.FloatField()
    shape_area = models.FloatField()
    geom = models.MultiPolygonField(srid=4326) 

    def __str__(self):
        return self.adm0_name if self.adm0_name else "Unknown"
    
    class Meta:
        verbose_name_plural = "GhaAdmin1"
        db_table = 'Impact_ghaadmin1'


class Admin1(models.Model):
    objectid = models.BigIntegerField()
    country = models.CharField(max_length=254)
    area = models.FloatField()
    shape_leng = models.FloatField()
    shape_area = models.FloatField()
    land_under = models.CharField(max_length=254,null=True,blank=True)
    geom = models.MultiPolygonField(srid=4326)

    def __str__(self):
        return self.country  # Adjust as needed

class WaterBodies(models.Model):
    af_wtr_id = models.BigIntegerField()
    sqkm = models.FloatField()
    name_of_wa = models.CharField(max_length=254, blank=True, null=True)
    type_of_wa = models.CharField(max_length=254, blank=True, null=True)
    shape_area = models.FloatField()
    shape_len = models.FloatField()
    geom = models.MultiPolygonField(srid=4326)

    def __unicode__(self):
        return self.name_of_wa or "Unnamed Water Body"

    class Meta:
        verbose_name_plural = "WaterBodies"