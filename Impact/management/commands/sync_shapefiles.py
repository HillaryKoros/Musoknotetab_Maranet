import os
from io import BytesIO
import paramiko
from django.core.management.base import BaseCommand
from django.contrib.gis.utils import LayerMapping
from decouple import config
from Impact.models import (
    AffectedPopulation, ImpactedGDP, AffectedCrops,
    AffectedRoads, DisplacedPopulation, AffectedLivestock,
    AffectedGrazingLand
)

class Command(BaseCommand):
    help = 'Sync remote shapefiles from SFTP and upload to database'
    
    SHAPEFILE_DIR = './temp_shapefiles'  # Temporary local directory
    
    model_configurations = {
        AffectedPopulation: '202412190000_FPimpacts-Population.shp',
        ImpactedGDP: '202412190000_FPimpacts-GDP.shp',
        AffectedCrops: '202412190000_FPimpacts-Crops.shp',
        AffectedRoads: '202412190000_FPimpacts-KmRoads.shp',
        DisplacedPopulation: '202412190000_FPimpacts-Displaced.shp',
        AffectedLivestock: '202412190000_FPimpacts-Livestock.shp',
        AffectedGrazingLand: '202412190000_FPimpacts-Grazing.shp',
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
            # Ensure local shapefile directory exists
            os.makedirs(self.SHAPEFILE_DIR, exist_ok=True)
            
            # Connect to SFTP and download files
            self.sync_shapefiles()
            
            # Load shapefiles into the database
            self.load_shapefiles()
            
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Error: {str(e)}'))
            raise
        finally:
            # Clean up temporary files
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
        """Download shapefiles and their associated files from remote SFTP server."""
        sftp_host = config('sftp_host')
        sftp_port = config('sftp_port')
        sftp_username = config('sftp_username')
        sftp_password = config('sftp_password')
        remote_folder = config('remote_folder')
        
        # Required shapefile extensions
        extensions = ['.shp', '.shx', '.dbf', '.prj']
        
        # Ensure the remote folder path ends with a forward slash
        remote_folder = remote_folder.rstrip('/') + '/'
        
        self.stdout.write("Connecting to SFTP server...")
        sftp = self.connect_sftp(sftp_host, sftp_port, sftp_username, sftp_password)
        
        try:
            for model, filename in self.model_configurations.items():
                # Get the base filename without extension
                base_filename = os.path.splitext(filename)[0]
                
                # Download each required file
                for ext in extensions:
                    remote_file = f"{base_filename}{ext}"
                    local_path = os.path.join(self.SHAPEFILE_DIR, remote_file)
                    remote_path = os.path.join(remote_folder, remote_file).replace('\\', '/')
                    
                    try:
                        self.stdout.write(f"Downloading {remote_file}...")
                        sftp.get(remote_path, local_path)
                        self.stdout.write(self.style.SUCCESS(
                            f"Downloaded {remote_file} to {local_path}"
                        ))
                    except FileNotFoundError:
                        msg = f"Warning: {remote_file} not found at {remote_path}"
                        # Only raise error if missing .shp, .shx, or .dbf
                        if ext in ['.shp', '.shx', '.dbf']:
                            raise Exception(msg)
                        else:
                            self.stdout.write(self.style.WARNING(msg))
        finally:
            sftp.close()
    
    def load_shapefiles(self):
        """Load shapefiles into the database."""
        for model, filename in self.model_configurations.items():
            shapefile_path = os.path.join(self.SHAPEFILE_DIR, filename)
            
            self.stdout.write(f"Loading data for {model.__name__} from {shapefile_path}...")
            
            try:
                # Clear existing data for the model
                model.objects.all().delete()
                
                # Create the LayerMapping and save
                lm = LayerMapping(
                    model, 
                    shapefile_path, 
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
                    f"Error loading shapefile for {model.__name__}: {str(e)}"
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