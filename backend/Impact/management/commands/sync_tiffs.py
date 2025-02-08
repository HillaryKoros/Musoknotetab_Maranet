import os
import paramiko
from datetime import datetime, timedelta
from decouple import config
from django.core.management.base import BaseCommand
import tempfile
import shutil
import requests
from requests.auth import HTTPBasicAuth
import traceback
import time
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter

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
        
        # GeoServer configuration with URL switching
        self.primary_geoserver_url = 'http://geoserver:8080/geoserver'
        self.fallback_geoserver_url = 'http://127.0.0.1:8093/geoserver'
        self.geoserver_url = self.primary_geoserver_url  # Start with primary URL
        self.geoserver_username = config('GEOSERVER_USERNAME', default='admin')
        self.geoserver_password = config('GEOSERVER_PASSWORD', default='geoserver')
        self.geoserver_workspace = config('GEOSERVER_WORKSPACE', default='floodwatch')
        
        # Configure session with retry logic
        self.session = self.create_session_with_retries()

    def create_session_with_retries(self):
        """Create a requests session with retry logic"""
        session = requests.Session()
        retry_strategy = Retry(
            total=3,  # number of retries
            backoff_factor=1,  # wait 1, 2, 4 seconds between retries
            status_forcelist=[500, 502, 503, 504]  # HTTP status codes to retry on
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        session.verify = False  # Note: In production, you should handle SSL properly
        session.auth = (self.geoserver_username, self.geoserver_password)
        return session

    def check_geoserver_connection(self):
        """Check if GeoServer is accessible, with fallback to alternate URL"""
        def try_connection(url):
            try:
                response = self.session.get(
                    f"{url}/rest/about/version",
                    timeout=10
                )
                return response.status_code == 200
            except requests.exceptions.RequestException:
                return False

        # Try primary URL first
        self.stdout.write(f"Trying primary GeoServer URL: {self.primary_geoserver_url}")
        if try_connection(self.primary_geoserver_url):
            self.geoserver_url = self.primary_geoserver_url
            self.stdout.write(self.style.SUCCESS("Connected to primary GeoServer"))
            return True

        # Fall back to secondary URL
        self.stdout.write(self.style.WARNING(
            f"Primary GeoServer not accessible, trying fallback URL: {self.fallback_geoserver_url}"
        ))
        if try_connection(self.fallback_geoserver_url):
            self.geoserver_url = self.fallback_geoserver_url
            self.stdout.write(self.style.SUCCESS("Connected to fallback GeoServer"))
            return True

        self.stdout.write(self.style.ERROR(
            "Failed to connect to both primary and fallback GeoServer instances"
        ))
        return False

    def handle(self, *args, **kwargs):
        """Main command handler"""
        try:
            # Check GeoServer connection first
            if not self.check_geoserver_connection():
                self.stderr.write(self.style.ERROR(
                    "Cannot proceed without GeoServer connection. "
                    "Please check GeoServer status and configuration."
                ))
                return

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
            self.stderr.write(self.style.ERROR(
                f"Critical error: {str(e)}\n"
                f"Stack trace:\n{traceback.format_exc()}"
            ))
            raise
        finally:
            self.cleanup()

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
        """Publish TIFF files to GeoServer with improved error handling"""
        store_date = date.strftime('%Y%m%d')
        iso_date = date.strftime('%Y-%m-%dT%H:%M:%SZ')
        
        for store_name, filename_template in self.tiff_configurations.items():
            filename = filename_template.format(date=store_date)
            local_path = os.path.join(self.temp_dir, filename)
            
            if not os.path.exists(local_path):
                self.stdout.write(self.style.WARNING(f"Skipping {filename} - file not found"))
                continue
                
            dated_store_name = f"{store_name}_{store_date}"
            self.stdout.write(f"Publishing {filename} to GeoServer as {dated_store_name}...")
            
            try:
                # Delete existing store
                self.delete_store(dated_store_name)
                
                # Upload file
                success = self.upload_file(dated_store_name, local_path)
                if not success:
                    continue
                
                # Configure time dimension
                self.configure_time_dimension(dated_store_name, iso_date)
                
            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f"Error publishing {dated_store_name}: {str(e)}\n"
                    f"Stack trace: {traceback.format_exc()}"
                ))
                continue
        
        return True

    def delete_store(self, store_name):
        """Delete existing store if it exists"""
        try:
            delete_url = (f"{self.geoserver_url}/rest/workspaces/{self.geoserver_workspace}"
                         f"/coveragestores/{store_name}?recurse=true")
            response = self.session.delete(delete_url)
            if response.status_code not in (200, 404):  # 404 is ok - means store didn't exist
                self.stdout.write(self.style.WARNING(
                    f"Unexpected status when deleting store: {response.status_code}"
                ))
        except requests.exceptions.RequestException as e:
            self.stdout.write(self.style.WARNING(f"Error deleting store: {str(e)}"))

    def upload_file(self, store_name, file_path):
        """Upload file to GeoServer"""
        store_url = (f"{self.geoserver_url}/rest/workspaces/{self.geoserver_workspace}"
                    f"/coveragestores/{store_name}/file.geotiff")
        
        try:
            with open(file_path, 'rb') as f:
                response = self.session.put(
                    store_url,
                    data=f,
                    headers={'Content-type': 'image/tiff'}
                )
                
            if response.status_code != 201:
                raise Exception(
                    f"Failed to upload file. Status: {response.status_code}\n"
                    f"Response: {response.text}"
                )
            return True
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error uploading file: {str(e)}"))
            return False

    def configure_time_dimension(self, store_name, iso_date):
        """Configure time dimension for the layer"""
        layer_url = (f"{self.geoserver_url}/rest/workspaces/{self.geoserver_workspace}"
                    f"/coveragestores/{store_name}/coverages")
        
        layer_config = {
            "coverage": {
                "name": store_name,
                "title": store_name,
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
                }
            }
        }
        
        try:
            response = self.session.post(
                layer_url,
                json=layer_config,
                headers={'Content-type': 'application/json'}
            )
            
            if response.status_code not in (201, 200):
                self.stdout.write(self.style.WARNING(
                    f"Layer configuration warning: {response.status_code} - {response.text}"
                ))
            
        except requests.exceptions.RequestException as e:
            self.stdout.write(self.style.ERROR(f"Error configuring time dimension: {str(e)}"))

    def cleanup(self):
        """Cleanup resources"""
        if self.sftp:
            try:
                self.sftp.close()
            except:
                pass
        self.cleanup_temp_files()
        try:
            self.session.close()
        except:
            pass

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