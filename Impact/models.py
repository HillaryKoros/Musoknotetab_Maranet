from django.db import models

# Create your models here.

# Create a model called Impacts that has the following fields:
class Impacts(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    def __str__(self):
        return self.name