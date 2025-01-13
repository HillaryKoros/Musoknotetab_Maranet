import os
from django.core.management.base import BaseCommand
from django.contrib.gis.utils import LayerMapping
from django.conf import settings
from Impact.models import SectorData

# Define the mapping between model fields and shapefile attributes
MAPPING = {
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
    'geom': 'POINT',
}

class Command(BaseCommand):
    help = 'Synchronizes sector data from shapefiles into the database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--shapefile-path',
            type=str,
            default='data/fp_sections_igad.shp',
            help='Path to the shapefile relative to project root'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before importing'
        )

    def handle(self, *args, **options):
        shapefile_path = options['shapefile_path']
        clear_existing = options['clear']

        # Construct absolute path
        abs_path = os.path.join(settings.BASE_DIR, shapefile_path)

        if not os.path.exists(abs_path):
            self.stderr.write(
                self.style.ERROR(f'Shapefile not found at: {abs_path}')
            )
            return

        try:
            # Clear existing data if requested
            if clear_existing:
                self.stdout.write('Clearing existing sector data...')
                SectorData.objects.all().delete()

            # Initialize the LayerMapping
            lm = LayerMapping(
                model=SectorData,
                data=abs_path,
                mapping=MAPPING,
                transform=False,  # Set to True if coordinate transformation is needed
                encoding='utf-8'
            )

            self.stdout.write('Starting shapefile import...')
            
            # Perform the import
            lm.save(
                strict=True,  # Raise exceptions for invalid data
                verbose=True,
                progress=True
            )

            # Count imported records
            record_count = SectorData.objects.count()
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully imported {record_count} records from shapefile'
                )
            )

        except Exception as e:
            self.stderr.write(
                self.style.ERROR(f'Error during import: {str(e)}')
            )
            raise