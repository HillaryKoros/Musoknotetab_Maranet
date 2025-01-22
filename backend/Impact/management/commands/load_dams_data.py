import os
import geopandas as gpd
from django.core.management.base import BaseCommand
from django.contrib.gis.utils import LayerMapping
from Impact.models import WaterBodies

class Command(BaseCommand):
    help = 'Sync dams shapefiles from a static directory and upload to database'

    SHAPEFILE_DIR = '/mnt/d/Consultancy/ICPAC-IGAD Hydrological Forecasting Services in GHA/Pipeline and Data/Vectors'
    DAMS_FILENAME = 'water_bodies.shp'

    # Layer mapping dictionary for WaterBodies model
    field_mapping = {
        'fid': 'fid',
        'af_wtr_id': 'AF_WTR_ID',
        'sqkm': 'SQKM',
        'name_of_wa': 'NAME_OF_WA',
        'type_of_wa': 'TYPE_OF_WA',
        'shape_area': 'Shape_area',
        'shape_len': 'Shape_len',
        'geom': 'MULTIPOLYGON',
    }

    def handle(self, *args, **kwargs):
        """Main command handler"""
        try:
            self.load_dams_data()
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Error: {str(e)}'))
            raise

    def load_dams_data(self):
        """Load dams data into the database using LayerMapping."""
        file_path = os.path.join(self.SHAPEFILE_DIR, self.DAMS_FILENAME)

        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Shapefile not found at {file_path}")

        self.stdout.write(f"Loading dams data from {file_path}...")

        try:
            # Clear existing data
            WaterBodies.objects.all().delete()

            # Debug output for shapefile structure
            gdf = gpd.read_file(file_path)
            self.stdout.write(f"Columns in shapefile: {gdf.columns.tolist()}")
            self.stdout.write(f"First row data: {gdf.iloc[0].to_dict()}")

            # Use LayerMapping to load the data
            lm = LayerMapping(
                WaterBodies,
                file_path,
                self.field_mapping,
                transform=True,  # Transform coordinates to match database SRID
                encoding='utf-8'
            )
            lm.save(strict=True, verbose=True)

            self.stdout.write(self.style.SUCCESS(
                f"Successfully loaded dams data into database."
            ))

        except Exception as e:
            raise Exception(f"Error loading dams data: {str(e)}")
