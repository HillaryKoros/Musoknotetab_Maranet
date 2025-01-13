import os
from django.core.management.base import BaseCommand
from django.contrib.gis.utils import LayerMapping
from django.contrib.gis.gdal import DataSource
from django.conf import settings
from django.db import transaction
from Impact.models import WaterBody

MAPPING = {
    'fid': 'fid',
    'af_wtr_id': 'AF_WTR_ID',
    'sqkm': 'SQKM',
    'name_of_wa': 'NAME_OF_WA',
    'type_of_wa': 'TYPE_OF_WA',
    'shape_area': 'Shape_area',
    'shape_len': 'Shape_len',
    'geom': 'GEOMETRY',  
}

class Command(BaseCommand):
    help = 'Synchronizes water body data from shapefiles into the database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--shapefile-path',
            type=str,
            default='data/water_bodies.shp',
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
        successful_imports = 0

        # Construct absolute path
        abs_path = os.path.join(settings.BASE_DIR, shapefile_path)

        if not os.path.exists(abs_path):
            self.stderr.write(
                self.style.ERROR(f'Shapefile not found at: {abs_path}')
            )
            return

        # Clear existing data if requested
        if clear_existing:
            self.stdout.write('Clearing existing water body data...')
            WaterBody.objects.all().delete()

        # Open the shapefile
        ds = DataSource(abs_path)
        layer = ds[0]

        self.stdout.write('Starting shapefile import...')

        # Import features one by one
        for feature in layer:
            try:
                with transaction.atomic():
                    water_body = WaterBody(
                        fid=feature.get('fid'),
                        af_wtr_id=feature.get('AF_WTR_ID'),
                        sqkm=feature.get('SQKM'),
                        name_of_wa=feature.get('NAME_OF_WA'),
                        type_of_wa=feature.get('TYPE_OF_WA'),
                        shape_area=feature.get('Shape_area'),
                        shape_len=feature.get('Shape_len'),
                        geom=feature.geom.wkt
                    )
                    water_body.save()
                    successful_imports += 1
                    self.stdout.write(f'Saved: WaterBody object ({successful_imports})')

            except Exception as e:
                self.stderr.write(
                    self.style.WARNING(
                        f'Failed to save feature into the model with the keyword arguments:\n'
                        f'fid={feature.get("fid")}, '
                        f'name={feature.get("NAME_OF_WA")}\n'
                        f'Error: {str(e)}'
                    )
                )
                continue

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully imported {successful_imports} records from shapefile'
            )
        )