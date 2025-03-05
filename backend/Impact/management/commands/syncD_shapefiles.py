import os
from io import BytesIO
import paramiko
from datetime import datetime, timedelta  # Add timedelta for yesterday's date
import geopandas as gpd
import pandas as pd
from django.core.management.base import BaseCommand
from django.contrib.gis.utils import LayerMapping
from decouple import config
from Impact.models import (
    AffectedPopulation, ImpactedGDP, AffectedCrops,
    AffectedRoads, DisplacedPopulation, AffectedLivestock,
    AffectedGrazingLand
)

current_date = datetime.now().strftime('%Y%m%d')

class Command(BaseCommand):
    help = 'Sync remote impact layer shapefiles from SFTP and upload to database'
    
    SHAPEFILE_DIR = './temp_shapefiles'
    
    model_configurations = {
        AffectedPopulation: f'{current_date}0000_FPimpacts-Population.shp',
        ImpactedGDP: f'{current_date}0000_FPimpacts-GDP.shp',
        AffectedCrops: f'{current_date}0000_FPimpacts-Crops.shp',
        AffectedRoads: f'{current_date}0000_FPimpacts-KmRoads.shp',
        DisplacedPopulation: f'{current_date}0000_FPimpacts-Displaced.shp',
        AffectedLivestock: f'{current_date}0000_FPimpacts-Livestock.shp',
        AffectedGrazingLand: f'{current_date}0000_FPimpacts-Grazing.shp'
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
        """Download impact layer shapefiles from remote SFTP server with fallback to yesterday."""
        sftp_host = config('SFTP_HOST')
        sftp_port = config('SFTP_PORT')
        sftp_username = config('SFTP_USERNAME')
        sftp_password = config('SFTP_PASSWORD')
        remote_folder_base = config('REMOTE_FOLDER_BASE')
        
        extensions = ['.shp', '.shx', '.dbf', '.prj']
        today = datetime.now()
        yesterday = today - timedelta(days=1)
        date_attempts = [
            (today.strftime('%Y/%m/%d/00'), today.strftime('%Y%m%d')),
            (yesterday.strftime('%Y/%m/%d/00'), yesterday.strftime('%Y%m%d'))
        ]
        
        self.stdout.write("Connecting to SFTP server...")
        sftp = self.connect_sftp(sftp_host, sftp_port, sftp_username, sftp_password)
        
        try:
            for model, filename_template in self.model_configurations.items():
                base_filename_template = os.path.splitext(filename_template)[0]  # e.g., '202503050000_FPimpacts-Population'
                downloaded = False
                
                # Try today, then yesterday if today fails
                for remote_folder, date_str in date_attempts:
                    if downloaded:
                        break  # Skip further attempts if already downloaded
                    
                    # Update filename with the current date being tried
                    base_filename = base_filename_template.replace(current_date, date_str)
                    remote_folder_path = f"{remote_folder_base}/{remote_folder}"
                    
                    self.stdout.write(f"Trying to download files for {date_str} from {remote_folder_path}...")
                    
                    try:
                        # Download all required extensions
                        for ext in extensions:
                            remote_file = f"{base_filename}{ext}"
                            local_path = os.path.join(self.SHAPEFILE_DIR, remote_file)
                            remote_path = os.path.join(remote_folder_path, remote_file).replace('\\', '/')
                            
                            self.stdout.write(f"Downloading {remote_file}...")
                            sftp.get(remote_path, local_path)
                            # Check if file is empty
                            if os.path.getsize(local_path) == 0:
                                raise Exception(f"Downloaded file {local_path} is empty")
                            self.stdout.write(self.style.SUCCESS(
                                f"Downloaded {remote_file} to {local_path}"
                            ))
                        
                        downloaded = True
                        # Update model_configurations with the full filename including .shp
                        self.model_configurations[model] = f"{base_filename}.shp"
                    
                    except FileNotFoundError as e:
                        msg = f"Warning: {remote_file} not found at {remote_path}"
                        if ext in ['.shp', '.shx', '.dbf']:  # Critical files
                            self.stdout.write(self.style.WARNING(msg))
                            if date_str == yesterday.strftime('%Y%m%d'):  # Last attempt failed
                                raise Exception(f"Failed to find critical files for {model.__name__} even in yesterday's data")
                        else:  # Optional files like .prj
                            self.stdout.write(self.style.WARNING(msg))
                            downloaded = True  # Consider it downloaded if only .prj is missing
                    except Exception as e:
                        raise Exception(f"Error downloading {remote_file}: {str(e)}")
        
        finally:
            sftp.close()

    def load_shapefiles(self):
        """Load impact layer shapefiles into the database."""
        for model, filename in self.model_configurations.items():
            file_path = os.path.join(self.SHAPEFILE_DIR, filename)
            
            # Ensure the file exists
            if not os.path.exists(file_path):
                raise Exception(f"Shapefile not found at {file_path}")
            
            self.stdout.write(f"Loading data for {model.__name__} from {file_path}...")
            
            try:
                # Clear existing data
                model.objects.all().delete()
                
                # Load shapefile using LayerMapping
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
                self.stdout.write(self.style.ERROR(f"Full error: {str(e)}"))
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