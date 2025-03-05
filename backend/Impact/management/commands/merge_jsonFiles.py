import os
import json
from datetime import datetime, timedelta
import paramiko
import geopandas as gpd
from django.core.management.base import BaseCommand
from decouple import config
import tempfile

class Command(BaseCommand):
    help = 'Download and process remote JSON and shapefile data from an SFTP server.'

    def get_data_path(self, base_date=None):
        if base_date is None:
            base_date = datetime.now()
        year = str(base_date.year)
        month = str(base_date.month).zfill(2)
        day = str(base_date.day).zfill(2)
        
        json_remote_dir = config('JSON_REMOTE_DIR').rstrip('/')
        
        base_path = f"{json_remote_dir}/{year}/{month}/{day}"
        full_path = f"{base_path}/00"
        
        return base_path, full_path, base_date

    def get_frontend_public_dir(self):
        """Get the correct path to the data directory with write permission check."""
        # First check if path is specified in environment
        from decouple import config
        frontend_dir = config('FRONTEND_PUBLIC_DIR', default=None)
        
        # Priority 1: Docker-mounted data directory in backend
        data_dir = '/backend/data'
        if os.path.exists(data_dir):
            # Verify it's writable
            test_file = os.path.join(data_dir, '.write_test')
            try:
                with open(test_file, 'w') as f:
                    f.write('test')
                os.remove(test_file)
                self.stdout.write(self.style.SUCCESS(f"Using writable directory: {data_dir}"))
                return data_dir
            except (IOError, PermissionError) as e:
                self.stdout.write(self.style.WARNING(f"Directory {data_dir} exists but is not writable: {e}"))
        
        # Priority 2: Environment variable if specified and writable
        if frontend_dir and os.path.exists(frontend_dir):
            test_file = os.path.join(frontend_dir, '.write_test')
            try:
                with open(test_file, 'w') as f:
                    f.write('test')
                os.remove(test_file)
                self.stdout.write(self.style.SUCCESS(f"Using writable directory from env: {frontend_dir}"))
                return frontend_dir
            except (IOError, PermissionError) as e:
                self.stdout.write(self.style.WARNING(f"Directory {frontend_dir} from env exists but is not writable: {e}"))
                
        # Priority 3: Frontend public directory mounted in backend
        frontend_public = '/frontend/public'
        if os.path.exists(frontend_public):
            test_file = os.path.join(frontend_public, '.write_test')
            try:
                with open(test_file, 'w') as f:
                    f.write('test')
                os.remove(test_file)
                self.stdout.write(self.style.SUCCESS(f"Using writable frontend public dir: {frontend_public}"))
                return frontend_public
            except (IOError, PermissionError) as e:
                self.stdout.write(self.style.WARNING(f"Directory {frontend_public} exists but is not writable: {e}"))
        
        # Priority 4: Try finding a writable temp directory as last resort
        temp_dir = tempfile.gettempdir()
        self.stdout.write(self.style.WARNING(f"Falling back to temp directory: {temp_dir}"))
        return temp_dir

    def check_remote_path_exists(self, sftp, path):
        """Check if a remote path exists on the SFTP server."""
        try:
            sftp.stat(path)
            return True
        except IOError:
            return False

    def get_valid_json_path(self, sftp, max_retries=7):
        """
        Get the most recent valid JSON path, falling back to previous days if needed.
        Returns tuple of (path, date) or (None, None) if no valid path found.
        """
        current_date = datetime.now()
        
        for i in range(max_retries):
            try_date = current_date - timedelta(days=i)
            _, full_path, _ = self.get_data_path(try_date)
            
            if self.check_remote_path_exists(sftp, full_path):
                return full_path, try_date
                
        return None, None

    def handle(self, *args, **kwargs):
        try:
            # Get the correct frontend/public directory path
            frontend_public_dir = self.get_frontend_public_dir()
            output_file = os.path.join(frontend_public_dir, 'merged_data.geojson')
            self.stdout.write(self.style.SUCCESS(f"Will attempt to save to: {output_file}"))
            
            # Create temporary directory for processing
            with tempfile.TemporaryDirectory() as temp_dir:
                # Create subdirectories in temp
                json_dir = os.path.join(temp_dir, 'json_files')
                shapefile_dir = os.path.join(temp_dir, 'shapefiles')
                os.makedirs(json_dir, exist_ok=True)
                os.makedirs(shapefile_dir, exist_ok=True)
                
                # Sync data from SFTP server to temp directory
                json_files, shapefile_dir = self.sync_data(json_dir, shapefile_dir)
                
                # Process and merge data, saving directly to frontend/public
                self.process_and_merge_data(json_files, shapefile_dir, output_file)

        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Error: {e}"))
            raise

    def connect_sftp(self):
        """Establish an SFTP connection."""
        hostname = config('SFTP_HOST')
        port = int(config('SFTP_PORT'))
        username = config('SFTP_USERNAME')
        password = config('SFTP_PASSWORD')

        try:
            transport = paramiko.Transport((hostname, port))
            transport.connect(username=username, password=password)
            return paramiko.SFTPClient.from_transport(transport)
        except Exception as e:
            raise Exception(f"Failed to connect to SFTP server: {e}")

    def sync_data(self, json_dir, shapefile_dir):
        """Download JSON and shapefile data from remote SFTP server."""
        sftp = self.connect_sftp()

        try:
            # Get valid JSON path with fallback
            json_path, data_date = self.get_valid_json_path(sftp)
            if not json_path:
                raise Exception("No valid JSON data found for the last 7 days")

            self.stdout.write(f"Using JSON data from: {data_date.strftime('%Y-%m-%d')}")

            # Get static shapefile directory
            shapefile_remote_dir = config('SHAPEFILE_REMOTE_DIR')
            if not self.check_remote_path_exists(sftp, shapefile_remote_dir):
                raise Exception(f"Shapefile directory not found: {shapefile_remote_dir}")

            # Download JSON files
            self.stdout.write("Downloading JSON files...")
            json_files = self.download_files(sftp, json_path, json_dir, '.json')

            # Download shapefiles
            self.stdout.write("Downloading shapefiles...")
            shapefile_extensions = ['.shp', '.shx', '.dbf', '.prj']
            self.download_files(sftp, shapefile_remote_dir, shapefile_dir, extensions=shapefile_extensions)

            return json_files, shapefile_dir

        finally:
            sftp.close()

    def download_files(self, sftp, remote_dir, local_dir, extensions):
        """Download files with specified extensions from a remote directory."""
        try:
            remote_files = sftp.listdir(remote_dir)
        except IOError as e:
            raise Exception(f"Error accessing remote directory {remote_dir}: {e}")

        downloaded_files = []

        for file in remote_files:
            if isinstance(extensions, str):
                valid = file.endswith(extensions)
            else:
                valid = any(file.endswith(ext) for ext in extensions)

            if valid:
                remote_path = os.path.join(remote_dir, file).replace('\\', '/')
                local_path = os.path.join(local_dir, file)

                try:
                    sftp.get(remote_path, local_path)
                    downloaded_files.append(local_path)
                    self.stdout.write(self.style.SUCCESS(f"Downloaded {file}"))
                except FileNotFoundError:
                    self.stderr.write(self.style.WARNING(f"File not found: {remote_path}"))
                except Exception as e:
                    self.stderr.write(self.style.WARNING(f"Error downloading {file}: {e}"))

        if not downloaded_files:
            raise Exception(f"No files with extensions {extensions} found in {remote_dir}")

        return downloaded_files

    def process_and_merge_data(self, json_files, shapefile_dir, output_file):
        """Merge JSON data with shapefiles and save as GeoJSON."""
        try:
            # First check if the output directory is writable
            output_dir = os.path.dirname(output_file)
            if not os.path.exists(output_dir):
                os.makedirs(output_dir, exist_ok=True)
                self.stdout.write(self.style.SUCCESS(f"Created directory: {output_dir}"))
            
            # Test if the directory is writable
            test_file = os.path.join(output_dir, '.write_test')
            try:
                with open(test_file, 'w') as f:
                    f.write('test')
                os.remove(test_file)
                self.stdout.write(self.style.SUCCESS(f"Directory {output_dir} is writable"))
            except (IOError, PermissionError) as e:
                # If not writable, switch to a temp file approach
                self.stdout.write(self.style.WARNING(
                    f"Output directory {output_dir} is not writable: {e}. Using temp file approach."
                ))
                temp_dir = tempfile.gettempdir()
                output_file = os.path.join(temp_dir, 'merged_data.geojson')
                self.stdout.write(self.style.WARNING(f"Changed output location to: {output_file}"))
            
            # Find the shapefile
            shapefile_path = next(
                (os.path.join(shapefile_dir, f) for f in os.listdir(shapefile_dir) if f.endswith('.shp')), None
            )

            if not shapefile_path:
                raise FileNotFoundError("No .shp file found in the specified directory.")

            gdf = gpd.read_file(shapefile_path)

            if gdf.crs is None:
                self.stdout.write(self.style.WARNING("Warning: CRS missing. Setting CRS to EPSG:4326."))
                gdf.set_crs('EPSG:4326', allow_override=True, inplace=True)

            merged_data = []

            for json_file in json_files:
                try:
                    with open(json_file, 'r') as file:
                        data = json.load(file)
                        if isinstance(data, str):
                            data = json.loads(data)
                        if not isinstance(data, (list, dict)):
                            raise ValueError(f"Invalid JSON format in {json_file}")
                        
                        if isinstance(data, dict):
                            data = [data]

                        for entry in data:
                            if not isinstance(entry, dict):
                                self.stdout.write(self.style.WARNING(
                                    f"Skipping invalid entry in {json_file}: {entry}"
                                ))
                                continue
                                
                            section_name = entry.get('section_name')
                            if section_name:
                                match = gdf[gdf['SEC_NAME'] == section_name]
                                if not match.empty:
                                    merged_entry = entry.copy()
                                    for col in match.columns:
                                        if col != 'geometry':
                                            merged_entry[col] = match.iloc[0][col]
                                    merged_entry['geometry'] = match.iloc[0].geometry
                                    merged_data.append(merged_entry)
                                else:
                                    self.stdout.write(self.style.WARNING(
                                        f"No match for section_name: {section_name}"
                                    ))
                except json.JSONDecodeError as e:
                    self.stderr.write(self.style.WARNING(
                        f"Error parsing JSON file {json_file}: {e}"
                    ))
                except Exception as e:
                    self.stderr.write(self.style.WARNING(
                        f"Error processing file {json_file}: {e}"
                    ))

            if merged_data:
                # Create the GeoDataFrame
                final_gdf = gpd.GeoDataFrame(merged_data, geometry='geometry')
                final_gdf.set_crs(epsg=4326, inplace=True)
                
                # Add metadata about the data date
                final_gdf.attrs['data_date'] = datetime.now().strftime('%Y-%m-%d')
                
                # Try a two-step approach if we're concerned about permissions
                try:
                    # If file exists, remove it before saving new data
                    if os.path.exists(output_file):
                        os.remove(output_file)
                    
                    # Try direct write
                    final_gdf.to_file(output_file, driver='GeoJSON')
                    self.stdout.write(self.style.SUCCESS(
                        f"Merged GeoJSON saved at {output_file}"
                    ))
                    
                    # If we redirected to a temp file, let the user know
                    if output_file.startswith(tempfile.gettempdir()):
                        self.stdout.write(self.style.WARNING(
                            f"Data saved to temporary location due to permission issues. "
                            f"Manual copy might be needed to: /usr/share/nginx/html/data/merged_data.geojson in frontend container"
                        ))
                    
                except (IOError, PermissionError) as e:
                    # If direct write fails, try with a temporary file
                    temp_file = os.path.join(tempfile.gettempdir(), 'temp_merged_data.geojson')
                    final_gdf.to_file(temp_file, driver='GeoJSON')
                    self.stdout.write(self.style.SUCCESS(
                        f"Merged GeoJSON temporarily saved at {temp_file}"
                    ))
                    self.stdout.write(self.style.WARNING(
                        f"Permission error writing to {output_file}: {e}"
                        f"Manual steps needed to copy {temp_file} to the appropriate location."
                    ))
            else:
                self.stdout.write(self.style.WARNING("No data to merge."))

        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Error merging data: {e}"))
            raise