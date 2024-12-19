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