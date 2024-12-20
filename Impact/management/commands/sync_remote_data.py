from django.core.management.base import BaseCommand
from io import BytesIO
import paramiko
import subprocess
import os
from decouple import config

class Command(BaseCommand):
    help = 'Sync remote shapefiles from SFTP and upload to database'

    def handle(self, *args, **kwargs):
        # SFTP connection credentials
        sftp_host = config('sfpt_host')
        sftp_port = config('sftp_port')
        sftp_username = config('sftp_username')
        sftp_password = config('sftp_password')


        # Connect to SFTP
        sftp = self.connect_sftp(sftp_host, sftp_port, sftp_username, sftp_password)
        
        # Remote folder path
        remote_folder = 'fp-eastafrica/storage/impact_assessment/fp_impact_forecast/nwp_gfs-det/2024/12/19/00'

        # List files in the remote folder
        files = sftp.listdir_attr(remote_folder)
        
        # Loop over files and process only shapefiles
        for file in files:
            file_name = file.filename
            remote_path = os.path.join(remote_folder, file_name)

            # Process shapefiles only
            if file_name.endswith('.shp'):
                try:
                    self.stdout.write(f"Processing shapefile: {file_name}")
                    self.process_shapefile(remote_path, sftp, file_name)
                except Exception as e:
                    self.stdout.write(f"Error processing {file_name}: {e}")

        # Disconnect from the SFTP server after processing
        sftp.close()


    # SFTP connection helper
    def connect_sftp(self, host, port, username, password):
        transport = paramiko.Transport((host, port))
        transport.connect(username=username, password=password)
        sftp = paramiko.SFTPClient.from_transport(transport)
        return sftp

    # Process shapefile helper
    def process_shapefile(self, remote_file_path, sftp, file_name):
        with BytesIO() as file_obj:
            # Get the shapefile from the remote SFTP server directly into memory
            sftp.getfo(remote_file_path, file_obj)
            file_obj.seek(0)

            # Write to a temporary file for use by shp2psql
            temp_filename = file_name  # Directly use the file name
            with open(temp_filename, 'wb') as f:
                f.write(file_obj.read())

            # Run the shp2psql command
            command = f"shp2psql -s 4326 -I {temp_filename} flood_watch_system public"
            process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            stdout, stderr = process.communicate()

            if process.returncode == 0:
                self.stdout.write(f"Successfully uploaded shapefile: {file_name}")
            else:
                self.stderr.write(f"Error uploading shapefile {file_name}: {stderr.decode('utf-8')}")

            # Clean up the temporary file
            os.remove(temp_filename)