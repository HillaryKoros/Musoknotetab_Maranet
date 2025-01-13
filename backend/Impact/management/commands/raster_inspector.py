from django.core.management.base import BaseCommand
from django.contrib.gis.gdal import GDALRaster
import os
from pathlib import Path
from datetime import datetime

class Command(BaseCommand):
    help = 'Inspect flood hazard raster file and generate Django model definition'

    def add_arguments(self, parser):
        parser.add_argument(
            'raster_path',
            nargs='?',
            type=str,
            default='/home/koros/IGAD-ICPAC/flood_hazard_map_floodproofs_202501030000.tif',
            help='Path to the flood hazard raster file'
        )
        parser.add_argument(
            '--model-name',
            type=str,
            default='FloodHazardRaster',
            help='Name for the generated model class'
        )

    def handle(self, *args, **options):
        raster_path = options['raster_path']
        model_name = options['model_name']

        if not os.path.exists(raster_path):
            self.stderr.write(self.style.ERROR(f'Flood hazard raster file not found: {raster_path}'))
            return

        try:
            # Open raster using Django's GDAL wrapper
            raster = GDALRaster(raster_path)
            
            # Get basic properties
            srid = raster.srid or 4326  # Default to 4326 if SRID is not set
            width = raster.width
            height = raster.height
            bands = len(raster.bands)
            
            # Get first band for additional properties
            band = raster.bands[0]
            
            # Map GDAL datatype to Django field type
            dtype_mapping = {
                'Byte': 'IntegerField',
                'UInt16': 'IntegerField',
                'Int16': 'IntegerField',
                'UInt32': 'IntegerField',
                'Int32': 'IntegerField',
                'Float32': 'FloatField',
                'Float64': 'FloatField',
            }
            django_type = dtype_mapping.get(band.datatype(as_string=True), 'FloatField')

            # Extract raster bounds and other properties
            min_x, min_y, max_x, max_y = raster.extent
            
            # Generate the model definition
            model_def = f"""
from django.contrib.gis.db import models
from django.contrib.postgres import fields

class {model_name}(models.Model):
    \"\"\"
    Flood Hazard Raster Layer Model for IGAD-ICPAC
    Generated from: {Path(raster_path).name}
    Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    
    Properties:
    - SRID: {srid}
    - Size: {width}x{height}
    - Bands: {bands}
    - Scale: {raster.scale}
    - Origin: {raster.origin}
    \"\"\"
    
    # Basic fields
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    date_generated = models.DateTimeField()
    upload_date = models.DateTimeField(auto_now_add=True)
    
    # Raster field
    raster = models.RasterField(srid={srid})
    
    # Flood hazard specific metadata
    hazard_type = models.CharField(max_length=50, default='flood')
    hazard_level = models.CharField(max_length=50)
    
    # Metadata fields
    nodata_value = models.{django_type}(
        null=True,
        default={band.nodata_value if band.nodata_value is not None else 'None'}
    )
    pixel_size_x = models.FloatField(default={raster.scale[0]})
    pixel_size_y = models.FloatField(default={abs(raster.scale[1])})
    number_of_bands = models.IntegerField(default={bands})
    width = models.IntegerField(default={width})
    height = models.IntegerField(default={height})
    
    # Bounds
    min_x = models.FloatField(default={min_x})
    min_y = models.FloatField(default={min_y})
    max_x = models.FloatField(default={max_x})
    max_y = models.FloatField(default={max_y})
    
    # Store additional metadata as JSON
    metadata = models.JSONField(default=dict)
    
    class Meta:
        db_table = 'flood_hazard_raster'
        indexes = [
            models.Index(fields=['date_generated']),
            models.Index(fields=['hazard_type', 'hazard_level']),
        ]
        
    def __str__(self):
        return f"{{self.name}} - {{self.date_generated.strftime('%Y-%m-%d')}}"
        
    @property
    def bounds(self):
        return (self.min_x, self.min_y, self.max_x, self.max_y)
        
    @property
    def resolution(self):
        return (self.pixel_size_x, self.pixel_size_y)
        
    @property
    def dimensions(self):
        return (self.width, self.height)
    
    def get_hazard_statistics(self):
        \"\"\"Calculate basic statistics for the flood hazard raster\"\"\"
        stats = dict()
        if self.raster:
            band_data = self.raster.bands[0].statistics()
            if band_data:
                stats['min'] = band_data.min
                stats['max'] = band_data.max
                stats['mean'] = band_data.mean
                stats['std'] = band_data.std
        return stats
"""
            # Output the model definition to the console
            self.stdout.write(self.style.SUCCESS('Generated Flood Hazard Model Definition:'))
            self.stdout.write('\n' + model_def)
            
            # Output raster information
            self.stdout.write(self.style.SUCCESS('\nFlood Hazard Raster Information:'))
            self.stdout.write(f'Driver: {raster.driver.name}')
            self.stdout.write(f'Dimensions: {width}x{height}')
            self.stdout.write(f'Number of bands: {bands}')
            self.stdout.write(f'SRID: {srid}')
            self.stdout.write(f'Pixel Size: {raster.scale}')
            self.stdout.write(f'Extent: {min_x}, {min_y}, {max_x}, {max_y}')
            
            # Output band statistics if available
            try:
                stats = band.statistics()
                if stats:
                    self.stdout.write('\nBand Statistics:')
                    self.stdout.write(f'Min: {stats.min}')
                    self.stdout.write(f'Max: {stats.max}')
                    self.stdout.write(f'Mean: {stats.mean}')
                    self.stdout.write(f'StdDev: {stats.std}')
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Could not compute band statistics: {str(e)}'))

        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Error inspecting flood hazard raster: {str(e)}'))
            raise
