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
import rasterio
import rasterio.warp
import numpy as np
from rasterio.transform import from_origin
try:
    from osgeo import gdal
    GDAL_AVAILABLE = True
except ImportError:
    GDAL_AVAILABLE = False

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
        
        # Merged alerts file path
        self.merged_alerts_file = os.path.join(self.temp_dir, 'merged_alerts.tif')
        
        # GeoServer configuration with URL switching
        self.primary_geoserver_url =  'http://flood_watch_geoserver:8080/geoserver'
        self.fallback_geoserver_url = 'http://10.10.1.13:8093/geoserver'
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
                # Skip merging and directly publish all files to GeoServer
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

    def merge_alert_files(self):
        """Merge the three alert TIFF files into a mosaic raster file with detailed analysis"""
        self.stdout.write("Merging alert files...")
        
        try:
            # Step 1: Get paths and validate alert files
            alert_files = []
            
            for store_name, filename_template in self.tiff_configurations.items():
                if 'alert' in store_name:
                    filename = filename_template.format(date=self.current_date.strftime('%Y%m%d'))
                    file_path = os.path.join(self.temp_dir, filename)
                    
                    if os.path.exists(file_path):
                        alert_files.append({
                            'path': file_path,
                            'name': store_name,
                            'filename': filename
                        })
            
            if not alert_files:
                self.stdout.write(self.style.WARNING("No alert files found to merge"))
                return False
            
            self.stdout.write(f"Found {len(alert_files)} alert files to merge: {[f['name'] for f in alert_files]}")
            
            # Step 2: Analyze the geographical extents of each file
            extents = []
            
            for file_info in alert_files:
                try:
                    with rasterio.open(file_info['path']) as src:
                        bounds = src.bounds
                        extents.append({
                            'name': file_info['name'],
                            'bounds': bounds,
                            'width': src.width,
                            'height': src.height,
                            'crs': src.crs
                        })
                        
                        self.stdout.write(f"Geographical extent for {file_info['name']}:")
                        self.stdout.write(f"  - Bounds: {bounds}")
                        self.stdout.write(f"  - Size: {src.width}x{src.height} pixels")
                        self.stdout.write(f"  - CRS: {src.crs}")
                        
                        # Read a sample of data to check for valid pixels
                        data = src.read(1)
                        nodata = src.nodata if src.nodata is not None else 0
                        valid_mask = data != nodata
                        valid_count = np.sum(valid_mask)
                        self.stdout.write(f"  - Valid pixels: {valid_count} ({valid_count/data.size*100:.2f}%)")
                        
                except Exception as e:
                    self.stdout.write(self.style.ERROR(
                        f"Error analyzing {file_info['name']}: {str(e)}"
                    ))
            
            # Step 3: Check for overlaps between the alert files
            if len(extents) >= 2:
                self.stdout.write("Analyzing overlaps between alert files:")
                
                for i in range(len(extents)):
                    for j in range(i+1, len(extents)):
                        # Check if the two extents overlap
                        e1 = extents[i]['bounds']
                        e2 = extents[j]['bounds']
                        
                        # Two bounding boxes overlap if:
                        # - One box's left edge is to the left of the other's right edge, AND
                        # - One box's right edge is to the right of the other's left edge, AND
                        # - One box's bottom edge is below the other's top edge, AND
                        # - One box's top edge is above the other's bottom edge
                        overlaps = (
                            e1.left < e2.right and 
                            e1.right > e2.left and 
                            e1.bottom < e2.top and 
                            e1.top > e2.bottom
                        )
                        
                        self.stdout.write(f"  - {extents[i]['name']} and {extents[j]['name']}: " + 
                                         f"{'OVERLAP' if overlaps else 'NO OVERLAP'}")
                
                # Calculate total extent that encompasses all alert files
                total_left = min(e['bounds'].left for e in extents)
                total_right = max(e['bounds'].right for e in extents)
                total_bottom = min(e['bounds'].bottom for e in extents)
                total_top = max(e['bounds'].top for e in extents)
                
                self.stdout.write("Total geographical extent needed for merged file:")
                self.stdout.write(f"  - Width: {total_left} to {total_right}")
                self.stdout.write(f"  - Height: {total_bottom} to {total_top}")
                
                # Calculate approximate resolution
                avg_res_x = sum((e['bounds'].right - e['bounds'].left) / e['width'] for e in extents) / len(extents)
                avg_res_y = sum((e['bounds'].top - e['bounds'].bottom) / e['height'] for e in extents) / len(extents)
                
                self.stdout.write(f"Average resolution: ~{avg_res_x:.8f} x ~{avg_res_y:.8f} degrees/pixel")
                
                # Estimate merged file size
                est_width = int((total_right - total_left) / avg_res_x)
                est_height = int((total_top - total_bottom) / avg_res_y)
                
                self.stdout.write(f"Estimated merged file size: ~{est_width}x{est_height} pixels")
                
                if est_width > 10000 or est_height > 10000:
                    self.stdout.write(self.style.WARNING(
                        f"Merged file could be very large ({est_width}x{est_height}). " + 
                        "Consider using a multi-band approach."
                    ))
            
            # Step 4: Try different merging strategies based on analysis results
            # First, try GDAL's BuildVRT which handles different projections and resolutions well
            input_files = [f['path'] for f in alert_files]
            
            if GDAL_AVAILABLE:
                try:
                    self.stdout.write("Attempting to merge with GDAL BuildVRT...")
                    
                    # Create VRT path
                    vrt_path = os.path.join(self.temp_dir, 'merged_alerts.vrt')
                    
                    # Run gdalbuildvrt
                    gdal.UseExceptions()
                    vrt_options = gdal.BuildVRTOptions(resampleAlg='nearest', separate=False)
                    vrt = gdal.BuildVRT(vrt_path, input_files, options=vrt_options)
                    
                    if vrt:
                        # Get reference values from first file
                        with rasterio.open(alert_files[0]['path']) as src:
                            ref_nodata = src.nodata if src.nodata is not None else 0
                        
                        # Translate to GeoTIFF
                        translate_options = gdal.TranslateOptions(
                            format='GTiff',
                            noData=ref_nodata,
                            creationOptions=['COMPRESS=LZW']
                        )
                        gdal.Translate(self.merged_alerts_file, vrt, options=translate_options)
                        vrt = None  # Close the dataset
                        
                        # Verify the output
                        if os.path.exists(self.merged_alerts_file):
                            with rasterio.open(self.merged_alerts_file) as src:
                                data = src.read(1)
                                nodata = src.nodata if src.nodata is not None else ref_nodata
                                valid_mask = data != nodata
                                valid_count = np.sum(valid_mask)
                                
                                self.stdout.write(f"GDAL BuildVRT merged file stats:")
                                self.stdout.write(f"  - Shape: {data.shape}")
                                self.stdout.write(f"  - Valid pixels: {valid_count} ({valid_count/data.size*100:.2f}%)")
                                
                                if valid_count > 0:
                                    self.stdout.write(self.style.SUCCESS(
                                        f"Alert files successfully merged with GDAL BuildVRT"
                                    ))
                                    return True
                                else:
                                    self.stdout.write(self.style.WARNING(
                                        "GDAL BuildVRT created a file with no valid data, trying multi-band approach"
                                    ))
                        else:
                            self.stdout.write(self.style.WARNING(
                                "GDAL BuildVRT failed to create output file, trying multi-band approach"
                            ))
                except Exception as e:
                    self.stdout.write(self.style.WARNING(
                        f"GDAL BuildVRT error: {str(e)}, trying multi-band approach"
                    ))
            
            # Multi-band approach: create a raster with each alert as a separate band
            self.stdout.write("Creating multi-band raster with each alert in a separate band...")
            
            # Use the first file's metadata as a template
            with rasterio.open(alert_files[0]['path']) as src:
                out_meta = src.meta.copy()
                
                # Update for multi-band output
                out_meta.update({
                    'count': len(alert_files),  # One band per alert file
                    'compress': 'lzw'
                })
                
                # Create the output file
                with rasterio.open(self.merged_alerts_file, 'w', **out_meta) as dst:
                    # Write each alert file as a separate band
                    for band_idx, file_info in enumerate(alert_files, start=1):
                        self.stdout.write(f"Writing {file_info['name']} to band {band_idx}")
                        
                        with rasterio.open(file_info['path']) as src:
                            data = src.read(1)
                            dst.write(data, band_idx)
            
            # Verify the multi-band output
            with rasterio.open(self.merged_alerts_file) as src:
                self.stdout.write(f"Multi-band file stats:")
                self.stdout.write(f"  - Shape: {src.shape}")
                self.stdout.write(f"  - Bands: {src.count}")
                
                # Check data in each band
                for band in range(1, src.count + 1):
                    data = src.read(band)
                    nodata = src.nodata if src.nodata is not None else 0
                    valid_mask = data != nodata
                    valid_count = np.sum(valid_mask)
                    
                    self.stdout.write(f"  - Band {band} valid pixels: {valid_count} ({valid_count/data.size*100:.2f}%)")
            
            self.stdout.write(self.style.SUCCESS(
                f"Created multi-band alert file with each alert in a separate band"
            ))
            return True
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f"Error merging alert files: {str(e)}\n"
                f"Stack trace: {traceback.format_exc()}"
            ))
            
            # Fall back to publishing individual alert files
            self.stdout.write(self.style.WARNING(
                "Falling back to publishing individual alert files"
            ))
            return True  # Continue with individual files
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f"Error merging alert files: {str(e)}\n"
                f"Stack trace: {traceback.format_exc()}"
            ))
            return False

    def publish_to_geoserver(self, date):
        """Publish TIFF files to GeoServer with improved error handling"""
        store_date = date.strftime('%Y%m%d')
        iso_date = date.strftime('%Y-%m-%dT%H:%M:%SZ')
        
        # Check if merged alerts file exists
        merged_alerts_exists = os.path.exists(self.merged_alerts_file)
        
        if merged_alerts_exists:
            # Validate merged file before using it
            try:
                with rasterio.open(self.merged_alerts_file) as src:
                    data = src.read(1)
                    nodata = src.nodata if src.nodata is not None else 0
                    # Check if the file has any valid data (non-nodata values)
                    valid_data = data[data != nodata]
                    if len(valid_data) == 0:
                        self.stdout.write(self.style.WARNING(
                            "Merged alerts file exists but contains no valid data. "
                            "Using individual alert files instead."
                        ))
                        merged_alerts_exists = False
                    else:
                        self.stdout.write(self.style.SUCCESS(
                            f"Validated merged alerts file: {len(valid_data)} valid pixels"
                        ))
            except Exception as e:
                self.stdout.write(self.style.WARNING(
                    f"Error validating merged alerts file: {str(e)}. "
                    "Using individual alert files instead."
                ))
                merged_alerts_exists = False
        
        # Create publishing configuration
        if merged_alerts_exists:
            # Use merged alerts file if it exists and is valid
            self.stdout.write("Using merged alerts file for publishing")
            publish_configurations = {
                'flood_hazard': self.tiff_configurations['flood_hazard'].format(date=store_date),
                'alerts': 'merged_alerts.tif'  # Use the merged alerts file
            }
        else:
            # Fall back to individual alert files
            self.stdout.write("Using individual alert files for publishing")
            publish_configurations = {
                'flood_hazard': self.tiff_configurations['flood_hazard'].format(date=store_date)
            }
            
            # Add individual alert files
            for store_name, filename_template in self.tiff_configurations.items():
                if 'alert' in store_name:
                    publish_configurations[store_name] = filename_template.format(date=store_date)
        
        for store_name, filename in publish_configurations.items():
            local_path = os.path.join(self.temp_dir, filename)
            
            if not os.path.exists(local_path):
                self.stdout.write(self.style.WARNING(f"Skipping {filename} - file not found"))
                continue
            
            # Only add date to store name if it's not the alerts layer
            dated_store_name = store_name if store_name == 'alerts' else f"{store_name}_{store_date}"
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