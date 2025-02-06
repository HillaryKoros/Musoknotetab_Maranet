import os
import json
from datetime import datetime
import paramiko
import geopandas as gpd
from django.core.management.base import BaseCommand
from decouple import config
import tempfile

class Command(BaseCommand):
    help = 'Download and process remote JSON and shapefile data from an SFTP server.'

    def get_frontend_public_dir(self):
        """Get the correct path to frontend/public directory."""
        current_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
        project_root = os.path.dirname(backend_dir)
        frontend_public = os.path.join(project_root, 'frontend', 'public')
        
        if not os.path.exists(frontend_public):
            raise Exception(f"Frontend public directory not found at {frontend_public}")
            
        return frontend_public

    def handle(self, *args, **kwargs):
        try:
            # Get the correct frontend/public directory path
            frontend_public_dir = self.get_frontend_public_dir()
            output_file = os.path.join(frontend_public_dir, 'merged_data.geojson')
            
            # Create temporary directory for processing
            with tempfile.TemporaryDirectory() as temp_dir:
                # Create subdirectories in temp
                json_dir = os.path.join(temp_dir, 'json_files')
                shapefile_dir = os.path.join(temp_dir, 'shapefiles')
                os.makedirs(json_dir)
                os.makedirs(shapefile_dir)
                
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

        json_remote_dir = config('JSON_REMOTE_DIR')
        shapefile_remote_dir = config('SHAPEFILE_REMOTE_DIR')

        try:
            # Download JSON files
            self.stdout.write("Downloading JSON files...")
            json_files = self.download_files(sftp, json_remote_dir, json_dir, '.json')

            # Download shapefiles
            self.stdout.write("Downloading shapefiles...")
            shapefile_extensions = ['.shp', '.shx', '.dbf', '.prj']
            self.download_files(sftp, shapefile_remote_dir, shapefile_dir, extensions=shapefile_extensions)

            return json_files, shapefile_dir

        finally:
            sftp.close()

    def download_files(self, sftp, remote_dir, local_dir, extensions):
        """Download files with specified extensions from a remote directory."""
        remote_files = sftp.listdir(remote_dir)
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

        return downloaded_files

    def process_and_merge_data(self, json_files, shapefile_dir, output_file):
        """Merge JSON data with shapefiles and save as GeoJSON."""
        try:
            shapefile_path = next(
                (os.path.join(shapefile_dir, f) for f in os.listdir(shapefile_dir) if f.endswith('.shp')), None
            )

            if not shapefile_path:
                raise FileNotFoundError("No .shp file found in the specified directory.")

            gdf = gpd.read_file(shapefile_path)

            if gdf.crs is None:
                self.stdout.write("Warning: CRS missing. Setting CRS to EPSG:4326.")
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
                final_gdf = gpd.GeoDataFrame(merged_data, geometry='geometry')
                final_gdf.set_crs(epsg=4326, inplace=True)
                
                # If file exists, remove it before saving new data
                if os.path.exists(output_file):
                    os.remove(output_file)
                
                final_gdf.to_file(output_file, driver='GeoJSON')
                self.stdout.write(self.style.SUCCESS(
                    f"Merged GeoJSON saved at {output_file}"
                ))
            else:
                self.stdout.write("No data to merge.")

        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Error merging data: {e}"))
            raise