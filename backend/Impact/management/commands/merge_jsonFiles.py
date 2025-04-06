import os
import json
import shutil
from datetime import datetime, timedelta
import paramiko
import geopandas as gpd
from django.core.management.base import BaseCommand
from decouple import config
import tempfile

class Command(BaseCommand):
    help = 'Download and process remote JSON and shapefile data from an SFTP server.'

    """
    Constructs the remote SFTP path for JSON data based on a given date.
    Returns a tuple of (base_path, full_path, base_date).
    """
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

    """
    Determines the output directory, enforcing the shared volume (/app/shared_data/timeseries_data).
    Returns a tuple of (directory_path, is_shared_volume_flag).
    """
    def get_output_dir(self):
        # Enforce shared volume only
        shared_dir = '/app/shared_data/timeseries_data'
        is_shared_volume = True
        
        if not os.path.exists(shared_dir):
            try:
                os.makedirs(shared_dir)
                self.stdout.write(self.style.SUCCESS(f"Created shared volume directory: {shared_dir}"))
            except Exception as e:
                raise Exception(f"Could not create {shared_dir}: {e}. Check permissions or volume mounting.")
        
        try:
            # Verify writability
            test_file = os.path.join(shared_dir, '.write_test')
            with open(test_file, 'w') as f:
                f.write('test')
            os.remove(test_file)
            self.stdout.write(self.style.SUCCESS(f"Using writable shared volume: {shared_dir}"))
        except (IOError, PermissionError) as e:
            raise Exception(f"Shared volume {shared_dir} not writable: {e}. Ensure permissions and volume are correctly configured.")
        
        return shared_dir, is_shared_volume

    """
    Checks if a remote path exists on the SFTP server.
    Returns True if the path exists, False otherwise.
    """
    def check_remote_path_exists(self, sftp, path):
        try:
            sftp.stat(path)
            return True
        except IOError:
            return False

    """
    Finds the most recent valid JSON path on the SFTP server, falling back up to max_retries days.
    Returns a tuple of (path, date) or (None, None) if no valid path is found.
    """
    def get_valid_json_path(self, sftp, max_retries=7):
        current_date = datetime.now()
        
        for i in range(max_retries):
            try_date = current_date - timedelta(days=i)
            _, full_path, _ = self.get_data_path(try_date)
            
            if self.check_remote_path_exists(sftp, full_path):
                return full_path, try_date
                
        return None, None

    """
    Main entry point for the command.
    Handles the workflow: determines output directory, syncs data, processes it, and saves the result.
    """
    def handle(self, *args, **kwargs):
        try:
            # Get the output directory (shared volume only)
            output_dir, is_shared_volume = self.get_output_dir()
            output_file = os.path.join(output_dir, 'merged_data.geojson')
            self.stdout.write(self.style.SUCCESS(f"Will save to: {output_file} (Shared volume: {is_shared_volume})"))
            
            # Create temporary directory for processing intermediate files
            with tempfile.TemporaryDirectory() as temp_dir:
                json_dir = os.path.join(temp_dir, 'json_files')
                shapefile_dir = os.path.join(temp_dir, 'shapefiles')
                os.makedirs(json_dir, exist_ok=True)
                os.makedirs(shapefile_dir, exist_ok=True)
                
                # Sync data from SFTP server to temp directory
                json_files, shapefile_dir = self.sync_data(json_dir, shapefile_dir)
                
                # Process and merge data, saving to the shared volume
                self.process_and_merge_data(json_files, shapefile_dir, output_file)

        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Error: {e}"))
            raise

    """
    Establishes an SFTP connection using credentials from environment variables.
    Returns an SFTP client object or raises an exception on failure.
    """
    def connect_sftp(self):
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

    """
    Downloads JSON and shapefile data from the SFTP server to temporary local directories.
    Returns a tuple of (json_files_list, shapefile_dir).
    """
    def sync_data(self, json_dir, shapefile_dir):
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

    """
    Downloads files with specified extensions from a remote SFTP directory to a local directory.
    Returns a list of downloaded file paths.
    """
    def download_files(self, sftp, remote_dir, local_dir, extensions):
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

    """
    Merges JSON data with shapefiles and saves the result as a GeoJSON file to the output location.
    Handles CRS assignment and data validation.
    """
    def process_and_merge_data(self, json_files, shapefile_dir, output_file):
        try:
            # Ensure the output directory exists and is writable
            output_dir = os.path.dirname(output_file)
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)
                self.stdout.write(self.style.SUCCESS(f"Created output directory: {output_dir}"))
            
            # Test if the directory is writable
            test_file = os.path.join(output_dir, '.write_test')
            try:
                with open(test_file, 'w') as f:
                    f.write('test')
                os.remove(test_file)
                self.stdout.write(self.style.SUCCESS(f"Directory {output_dir} is writable"))
            except (IOError, PermissionError) as e:
                raise Exception(f"Cannot write to {output_dir}: {e}. Ensure permissions are correct.")

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
                
                # Save to the output file
                if os.path.exists(output_file):
                    os.remove(output_file)
                
                final_gdf.to_file(output_file, driver='GeoJSON')
                self.stdout.write(self.style.SUCCESS(f"Merged GeoJSON saved at {output_file}"))
            else:
                self.stdout.write(self.style.WARNING("No data to merge."))

        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Error merging data: {e}"))
            raise