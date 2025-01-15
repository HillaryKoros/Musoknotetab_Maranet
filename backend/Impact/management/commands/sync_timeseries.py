import os
import json
from datetime import datetime
import paramiko
import geopandas as gpd
from django.core.management.base import BaseCommand
from decouple import config

class Command(BaseCommand):
    help = 'Download and process remote JSON and shapefile data from an SFTP server.'

    BASE_DIR = './temp_data'  # Temporary local directory
    OUTPUT_GEOJSON = 'merged_data.geojson'  # Name of the output file

    def handle(self, *args, **kwargs):
        try:
            # Ensure local directories exist
            os.makedirs(self.BASE_DIR, exist_ok=True)
            
            # Sync data from SFTP server
            json_files, shapefile_dir = self.sync_data()
            
            # Process and merge data
            self.process_and_merge_data(json_files, shapefile_dir)

        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Error: {e}"))
            raise
        finally:
            # Only clean up temporary files, not the final output
            self.cleanup_temp_files(exclude=[self.OUTPUT_GEOJSON])

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

    def sync_data(self):
        """Download JSON and shapefile data from remote SFTP server."""
        sftp = self.connect_sftp()

        json_remote_dir = config('JSON_REMOTE_DIR')
        shapefile_remote_dir = config('SHAPEFILE_REMOTE_DIR')
        json_local_dir = os.path.join(self.BASE_DIR, 'json_files')
        shapefile_local_dir = os.path.join(self.BASE_DIR, 'shapefiles')

        os.makedirs(json_local_dir, exist_ok=True)
        os.makedirs(shapefile_local_dir, exist_ok=True)

        try:
            # Download JSON files
            self.stdout.write("Downloading JSON files...")
            json_files = self.download_files(sftp, json_remote_dir, json_local_dir, '.json')

            # Download shapefiles
            self.stdout.write("Downloading shapefiles...")
            shapefile_extensions = ['.shp', '.shx', '.dbf', '.prj']
            self.download_files(sftp, shapefile_remote_dir, shapefile_local_dir, extensions=shapefile_extensions)

            return json_files, shapefile_local_dir

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

    def process_and_merge_data(self, json_files, shapefile_dir):
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
                        # Safely parse JSON and ensure it's a list or dict
                        data = json.load(file)
                        if isinstance(data, str):
                            data = json.loads(data)  # Handle double-encoded JSON
                        if not isinstance(data, (list, dict)):
                            raise ValueError(f"Invalid JSON format in {json_file}")
                        
                        # Convert single dict to list for consistent processing
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
                # Set CRS before saving
                final_gdf.set_crs(epsg=4326, inplace=True)
                output_geojson = os.path.join(self.BASE_DIR, self.OUTPUT_GEOJSON)
                # Save without passing CRS parameter
                final_gdf.to_file(output_geojson, driver='GeoJSON')
                self.stdout.write(self.style.SUCCESS(
                    f"Merged GeoJSON saved at {output_geojson}"
                ))
            else:
                self.stdout.write("No data to merge.")

        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Error merging data: {e}"))
            raise

    def cleanup_temp_files(self, exclude=None):
        """Clean up temporary files except for specified files."""
        self.stdout.write("Cleaning up temporary files...")
        exclude = exclude or []
        exclude_paths = [os.path.join(self.BASE_DIR, file) for file in exclude]
        
        for root, dirs, files in os.walk(self.BASE_DIR, topdown=False):
            for file in files:
                file_path = os.path.join(root, file)
                if file_path not in exclude_paths:
                    try:
                        os.remove(file_path)
                    except Exception as e:
                        self.stderr.write(self.style.WARNING(f"Error removing file {file}: {e}"))
            
            # Only remove directory if it's empty and not the BASE_DIR
            if not os.listdir(root) and root != self.BASE_DIR:
                try:
                    os.rmdir(root)
                except Exception as e:
                    self.stderr.write(self.style.WARNING(f"Error removing directory {root}: {e}"))