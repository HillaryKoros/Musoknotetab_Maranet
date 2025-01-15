import os
from io import BytesIO
import paramiko
from datetime import datetime
import geopandas as gpd
import pandas as pd
from django.core.management.base import BaseCommand
from django.contrib.gis.utils import LayerMapping
from django.contrib.gis.geos import Point
from decouple import config
from Impact.models import (
    AffectedPopulation, ImpactedGDP, AffectedCrops,
    AffectedRoads, DisplacedPopulation, AffectedLivestock,
    AffectedGrazingLand, SectorData
)

current_date = datetime.now().strftime('%Y%m%d')

class Command(BaseCommand):
    help = 'Sync remote shapefiles and sector data from SFTP and upload to database'
    
    SHAPEFILE_DIR = './temp_shapefiles'
    
    model_configurations = {
        AffectedPopulation: f'{current_date}0000_FPimpacts-Population.shp',
        ImpactedGDP: f'{current_date}0000_FPimpacts-GDP.shp',
        AffectedCrops: f'{current_date}0000_FPimpacts-Crops.shp',
        AffectedRoads: f'{current_date}0000_FPimpacts-KmRoads.shp',
        DisplacedPopulation: f'{current_date}0000_FPimpacts-Displaced.shp',
        AffectedLivestock: f'{current_date}0000_FPimpacts-Livestock.shp',
        AffectedGrazingLand: f'{current_date}0000_FPimpacts-Grazing.shp',
        SectorData: 'fp_sections_igad.shp'
    }
    
    field_mapping = {
        'gid_0': 'GID_0',
        'name_0': 'NAME_0',
        'name_1': 'NAME_1',
        'engtype_1': 'ENGTYPE_1',
        'lack_cc': 'LACK_CC',
        'cod': 'COD',
        'stock': 'stock',
        'flood_tot': 'flood_tot',
        'flood_perc': 'flood_perc',
        'geom': 'MULTIPOLYGON',
    }
    
    def handle(self, *args, **kwargs):
        """Main command handler"""
        try:
            os.makedirs(self.SHAPEFILE_DIR, exist_ok=True)
            self.sync_shapefiles()
            self.load_shapefiles()
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Error: {str(e)}'))
            raise
        finally:
            self.cleanup_temp_files()
    
    def connect_sftp(self, host, port, username, password):
        """Establish an SFTP connection."""
        try:
            transport = paramiko.Transport((host, int(port)))
            transport.connect(username=username, password=password)
            return paramiko.SFTPClient.from_transport(transport)
        except Exception as e:
            raise Exception(f"Failed to connect to SFTP server: {str(e)}")

    def sync_shapefiles(self):
        """Download shapefiles and sector data from remote SFTP server."""
        sftp_host = config('SFTP_HOST')
        sftp_port = config('SFTP_PORT')
        sftp_username = config('SFTP_USERNAME')
        sftp_password = config('SFTP_PASSWORD')
        remote_folder_base = config('REMOTE_FOLDER_BASE')
        sectors_remote_folder = config('SHAPEFILE_REMOTE_DIR')
        
        extensions = ['.shp', '.shx', '.dbf', '.prj']
        remote_date = datetime.now().strftime('%Y/%m/%d/00')
        remote_folder = f"{remote_folder_base}/{remote_date}"
        
        self.stdout.write("Connecting to SFTP server...")
        sftp = self.connect_sftp(sftp_host, sftp_port, sftp_username, sftp_password)
        
        try:
            for model, filename in self.model_configurations.items():
                base_filename = os.path.splitext(filename)[0]
                current_remote_folder = sectors_remote_folder if model == SectorData else remote_folder
                
                for ext in extensions:
                    remote_file = f"{base_filename}{ext}"
                    local_path = os.path.join(self.SHAPEFILE_DIR, remote_file)
                    remote_path = os.path.join(current_remote_folder, remote_file).replace('\\', '/')
                    
                    try:
                        self.stdout.write(f"Downloading {remote_file}...")
                        sftp.get(remote_path, local_path)
                        self.stdout.write(self.style.SUCCESS(
                            f"Downloaded {remote_file} to {local_path}"
                        ))
                    except FileNotFoundError:
                        msg = f"Warning: {remote_file} not found at {remote_path}"
                        if ext in ['.shp', '.shx', '.dbf']:
                            raise Exception(msg)
                        else:
                            self.stdout.write(self.style.WARNING(msg))
        finally:
            sftp.close()

    def safe_convert(self, value, type_func, default=None):
        """Safely convert values to specified type."""
        if pd.isna(value) or value == '':
            return default
        try:
            return type_func(value)
        except (ValueError, TypeError):
            return default

    def process_sector_data(self, gdf):
        """Process sector data with proper type conversion."""
        processed_records = []
        
        for idx, row in gdf.iterrows():
            try:
                # Debug output for sec_code
                self.stdout.write(f"Raw sec_code value: {row.get('sec_code')}, Type: {type(row.get('sec_code'))}")
                
                # Handle geometry
                if row.geometry.geom_type == 'Point':
                    coords = (row.geometry.x, row.geometry.y)
                else:
                    coords = (row.geometry.centroid.x, row.geometry.centroid.y)
                point = Point(coords[0], coords[1], srid=4326)
                
                # Create sector record with proper type conversion
                sector_record = {
                    'sec_code': self.safe_convert(row.get('sec_code'), int, 0),
                    'sec_name': str(row.get('sec_name', '')),
                    'basin': str(row.get('basin', '')),
                    'domain': str(row.get('domain', '')),
                    'admin_b_l1': str(row.get('admin_b_l1', '')),
                    'admin_b_l2': str(row.get('admin_b_l2', '')),
                    'admin_b_l3': str(row.get('admin_b_l3', '')),
                    'sec_rs': str(row.get('sec_rs', '')),
                    'area': self.safe_convert(row.get('area'), float, 0.0),
                    'lat': self.safe_convert(row.get('lat'), float, 0.0),
                    'lon': self.safe_convert(row.get('lon'), float, 0.0),
                    'q_thr1': self.safe_convert(row.get('q_thr1'), float, 0.0),
                    'q_thr2': self.safe_convert(row.get('q_thr2'), float, 0.0),
                    'q_thr3': self.safe_convert(row.get('q_thr3'), float, 0.0),
                    'cat': str(row.get('cat', '')),
                    'geom': point
                }
                
                # Add ID if it exists
                if 'id' in row:
                    sector_record['id'] = self.safe_convert(row.get('id'), int, None)
                
                processed_records.append(sector_record)
                
                if (idx + 1) % 100 == 0:
                    self.stdout.write(f"Processed {idx + 1} sectors...")
                    
            except Exception as e:
                self.stdout.write(self.style.WARNING(
                    f"Error processing sector at index {idx}: {str(e)}\n"
                    f"Raw data: {row.to_dict()}"
                ))
                continue
                
        return processed_records

    def load_shapefiles(self):
        """Load shapefiles and sector data into the database."""
        for model, filename in self.model_configurations.items():
            file_path = os.path.join(self.SHAPEFILE_DIR, filename)
            
            self.stdout.write(f"Loading data for {model.__name__} from {file_path}...")
            
            try:
                # Clear existing data
                model.objects.all().delete()
                
                if model == SectorData:
                    # Read and process sector data
                    gdf = gpd.read_file(file_path)
                    
                    # Debug output for data structure
                    self.stdout.write(f"Columns in shapefile: {gdf.columns.tolist()}")
                    self.stdout.write(f"First row data: {gdf.iloc[0].to_dict()}")
                    
                    # Process and save sectors
                    processed_records = self.process_sector_data(gdf)
                    
                    # Bulk create records
                    sectors_to_create = [SectorData(**record) for record in processed_records]
                    SectorData.objects.bulk_create(sectors_to_create, batch_size=100)
                    
                    self.stdout.write(self.style.SUCCESS(
                        f"Successfully loaded {len(processed_records)} sectors into database."
                    ))
                else:
                    # Handle regular shapefile loading
                    lm = LayerMapping(
                        model, 
                        file_path, 
                        self.field_mapping,
                        transform=False,
                        encoding='iso-8859-1'
                    )
                    lm.save(strict=True, verbose=True)
                
                self.stdout.write(self.style.SUCCESS(
                    f"Data for {model.__name__} loaded successfully."
                ))
            
            except Exception as e:
                raise Exception(
                    f"Error loading data for {model.__name__}: {str(e)}"
                )
    
    def cleanup_temp_files(self):
        """Clean up temporary files after processing."""
        self.stdout.write("Cleaning up temporary files...")
        if os.path.exists(self.SHAPEFILE_DIR):
            for filename in os.listdir(self.SHAPEFILE_DIR):
                file_path = os.path.join(self.SHAPEFILE_DIR, filename)
                try:
                    os.remove(file_path)
                    self.stdout.write(f"Removed {file_path}")
                except Exception as e:
                    self.stdout.write(self.style.WARNING(
                        f"Error removing {file_path}: {e}"
                    ))
            try:
                os.rmdir(self.SHAPEFILE_DIR)
                self.stdout.write("Removed temporary directory")
            except Exception as e:
                self.stdout.write(self.style.WARNING(
                    f"Error removing temporary directory: {e}"
                ))