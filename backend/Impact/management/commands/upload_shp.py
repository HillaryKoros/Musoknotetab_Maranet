import os
from django.core.management.base import BaseCommand
from django.contrib.gis.utils import LayerMapping
from Impact.models import SectorData  # Import your SectorData model

# Field mapping for the shapefile and model fields
FIELD_MAPPING = {
    'sec_code': 'SEC_CODE',
    'sec_name': 'SEC_NAME',
    'basin': 'BASIN',
    'domain': 'DOMAIN',
    'admin_b_l1': 'ADMIN_B_L1',
    'admin_b_l2': 'ADMIN_B_L2',
    'admin_b_l3': 'ADMIN_B_L3',
    'sec_rs': 'SEC_RS',
    'area': 'AREA',
    'lat': 'LAT',
    'lon': 'LON',
    'q_thr1': 'Q_THR1',
    'q_thr2': 'Q_THR2',
    'q_thr3': 'Q_THR3',
    'cat': 'cat',
    'id': 'ID',
    'geom': 'POINT'
}

class Command(BaseCommand):
    help = 'Upload shapefile to the SectorData model'

    def handle(self, *args, **kwargs):
        shapefile_path = './data/fp_sections_igad.shp'  # Local shapefile path

        if not os.path.exists(shapefile_path):
            self.stderr.write(self.style.ERROR(f"Shapefile not found at {shapefile_path}"))
            return

        self.stdout.write(f"Loading shapefile {shapefile_path}...")

        # Initialize LayerMapping to upload the shapefile
        try:
            lm = LayerMapping(
                SectorData,           # The model
                shapefile_path,       # Path to the shapefile
                FIELD_MAPPING,        # Field mapping dictionary
                transform=False,      # Set to True if you need to transform coordinates
                encoding='utf-8'      # Ensure encoding is correct for your shapefile
            )

            # Save the shapefile data into the database
            lm.save(strict=True, verbose=True)
            self.stdout.write(self.style.SUCCESS("Shapefile successfully uploaded to the database!"))
        
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Error uploading shapefile: {str(e)}"))
