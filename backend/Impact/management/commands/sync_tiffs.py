import os
import paramiko
from datetime import datetime, timedelta
from decouple import config
from django.core.management.base import BaseCommand
from geoserver.catalog import Catalog
import tempfile
import shutil
import requests
from requests.auth import HTTPBasicAuth
import base64
import traceback
import time

class Command(BaseCommand):
    help = 'Sync remote TIFF files from SFTP and publish to GeoServer with fallback to previous day'
    
    def __init__(self):
        super().__init__()
        self.temp_dir = tempfile.mkdtemp()
        self.current_date = datetime.now()
        self.sftp = None
        
        # Configure TIFF files to process
        self.tiff_configurations = {
            'flood_hazard': 'flood_hazard_map_floodproofs_{date}0000.tif',
            'group1_alert': 'group1_mosaic_alert_level.tif',
            'group2_alert': 'group2_mosaic_alert_level.tif',
            'group4_alert': 'group4_mosaic_alert_level.tif'
        }

    def handle(self, *args, **kwargs):
        """Main command handler"""
        try:
            success = self.process_date(self.current_date)
            if not success:
                yesterday = self.current_date - timedelta(days=1)
                self.stdout.write(self.style.WARNING(
                    f"Today's data not found. Trying yesterday's date: {yesterday.strftime('%Y%m%d')}"
                ))
                success = self.process_date(yesterday)
                
            if not success:
             self.stdout.write(self.style.ERROR(
                "Could not process data for either today or yesterday. "
                "Please check the logs above for specific errors."
            ))
                
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Error: {str(e)}'))
            raise
        finally:
            if self.sftp:
                self.sftp.close()
            self.cleanup_temp_files()
    
    def process_date(self, date):
        """Process files for a specific date"""
        try:
            if not self.sftp:
                self.sftp = self.connect_sftp()
            
            if self.sync_tiffs(date):
                self.publish_to_geoserver(date)
                return True
            return False
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"Error processing {date.strftime('%Y%m%d')}: {str(e)}"))
            return False

    def connect_sftp(self):
        """Establish an SFTP connection"""
        try:
            transport = paramiko.Transport((
                config('SFTP_HOST'),
                int(config('SFTP_PORT'))
            ))
            transport.connect(
                username=config('SFTP_USERNAME'),
                password=config('SFTP_PASSWORD')
            )
            return paramiko.SFTPClient.from_transport(transport)
        except Exception as e:
            raise Exception(f"Failed to connect to SFTP server: {str(e)}")

    def check_remote_path_exists(self, path):
        """Check if a remote path exists"""
        try:
            self.sftp.stat(path)
            return True
        except IOError:
            return False

    def sync_tiffs(self, date):
        """Download TIFF files from remote SFTP server"""
        remote_base = config('REMOTE_FOLDER_BASE')
        remote_date = date.strftime('%Y/%m/%d/00/0000')
        remote_folder = f"{remote_base}/{remote_date}"
        hmc_folder = f"{remote_folder}/HMC"
        
        # Check if the remote folders exist
        if not self.check_remote_path_exists(remote_folder) or not self.check_remote_path_exists(hmc_folder):
            return False
        
        self.stdout.write(f"Processing files for date: {date.strftime('%Y%m%d')}")
        
        try:
            for store_name, filename_template in self.tiff_configurations.items():
                filename = filename_template.format(date=date.strftime('%Y%m%d'))
                local_path = os.path.join(self.temp_dir, filename)
                
                # Determine if file is in HMC folder or base folder
                remote_path = os.path.join(
                    hmc_folder if 'group' in filename else remote_folder,
                    filename
                ).replace('\\', '/')
                
                try:
                    self.stdout.write(f"Downloading {filename}...")
                    self.sftp.get(remote_path, local_path)
                    self.stdout.write(self.style.SUCCESS(
                        f"Downloaded {filename} to {local_path}"
                    ))
                except FileNotFoundError:
                    self.stdout.write(self.style.WARNING(f"File not found at {remote_path}"))
                    return False
            return True
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error during sync: {str(e)}"))
            return False

    def publish_to_geoserver(self, date):
        """Publish TIFF files to GeoServer"""
        try:
            geoserver_url = 'http://127.0.0.1:8093/geoserver'
            if not geoserver_url.endswith('/rest'):
                geoserver_url += '/rest'
                
            username = 'admin'
            password = 'geoserver'
            workspace = 'floodwatch'
            
            # Format date string for store name and time dimension
            store_date = date.strftime('%Y%m%d')
            iso_date = date.strftime('%Y-%m-%dT%H:%M:%SZ')  # ISO8601 format
            
            # Process each file
            for store_name, filename_template in self.tiff_configurations.items():
                filename = filename_template.format(date=store_date)
                local_path = os.path.join(self.temp_dir, filename)
                
                if not os.path.exists(local_path):
                    self.stdout.write(self.style.WARNING(f"Skipping {filename} - file not found"))
                    continue
                    
                # Append date to store name
                dated_store_name = f"{store_name}_{store_date}"
                self.stdout.write(f"Publishing {filename} to GeoServer as {dated_store_name}...")
                
                try:
                    # Create store URL with dated store name
                    store_url = f"{geoserver_url}/workspaces/{workspace}/coveragestores/{dated_store_name}/file.geotiff"
                    
                    # Delete existing store if it exists
                    delete_url = f"{geoserver_url}/workspaces/{workspace}/coveragestores/{dated_store_name}?recurse=true"
                    requests.delete(delete_url, auth=(username, password), verify=False)

                    # Read and upload the file
                    with open(local_path, 'rb') as f:
                        file_data = f.read()

                    self.stdout.write(f"Uploading {dated_store_name} to {store_url}")
                    
                    response = requests.put(
                        store_url,
                        data=file_data,
                        headers={'Content-type': 'image/tiff'},
                        auth=(username, password),
                        verify=False
                    )
                    
                    if response.status_code == 201:
                        self.stdout.write(self.style.SUCCESS(
                            f"Successfully published {dated_store_name} to GeoServer"
                        ))
                    else:
                        raise Exception(
                            f"Failed to upload file. Status: {response.status_code}\n"
                            f"Response: {response.text}"
                        )

                    # Configure the layer with time dimension
                    layer_url = f"{geoserver_url}/workspaces/{workspace}/coveragestores/{dated_store_name}/coverages"
                    layer_config = {
                        "coverage": {
                            "name": dated_store_name,
                            "title": f"{store_name} for {store_date}",
                            "enabled": True,
                            "metadata": {
                                "entry": [
                                    {
                                        "@key": "time",
                                        "dimensionInfo": {
                                            "enabled": True,
                                            "presentation": "LIST",
                                            "units": "ISO8601",
                                            "defaultValue": iso_date,
                                            "strategy": "FIXED",
                                            "reference": "TIME"
                                        }
                                    },
                                    {
                                        "@key": "time",
                                        "$": iso_date
                                    }
                                ]
                            },
                            "parameters": {
                                "entry": [
                                    {
                                        "string": ["time", iso_date]
                                    }
                                ]
                            }
                        }
                    }
                    
                    response = requests.post(
                        layer_url,
                        json=layer_config,
                        headers={'Content-type': 'application/json'},
                        auth=(username, password),
                        verify=False
                    )
                    
                    if response.status_code not in (201, 200):
                        self.stdout.write(self.style.WARNING(
                            f"Layer configuration warning: {response.status_code} - {response.text}"
                        ))
                    else:
                        self.stdout.write(self.style.SUCCESS(
                            f"Successfully configured time dimension for {dated_store_name}"
                        ))
                    
                except Exception as e:
                    self.stdout.write(self.style.ERROR(
                        f"Error publishing {dated_store_name}: {str(e)}\n"
                        f"Stack trace: {traceback.format_exc()}\n"
                        f"Continuing with next file..."
                    ))
                    continue
                    
            return True
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f"GeoServer error: {str(e)}\n"
                f"\nFull error: {traceback.format_exc()}"
            ))
            return False
    
    def cleanup_temp_files(self):
        """Clean up temporary files after processing"""
        self.stdout.write("Cleaning up temporary files...")
        try:
            shutil.rmtree(self.temp_dir)
            self.stdout.write(self.style.SUCCESS("Temporary files cleaned up successfully"))
        except Exception as e:
            self.stdout.write(self.style.WARNING(
                f"Error cleaning up temporary files: {e}"
            ))