# Use an official OpenJDK runtime as a parent image
FROM openjdk:17-jdk-slim

# Set the working directory to /opt
WORKDIR /opt

# Copy your local geoserver folder into the container
COPY geoserver /opt/geoserver

# Unzip GeoServer if necessary
RUN unzip /opt/geoserver/geoserver-2.22.2-bin.zip -d /opt/geoserver && \
    rm /opt/geoserver/geoserver-2.22.2-bin.zip

# Set environment variables (adjust this if needed)
ENV GEOSERVER_HOME /opt/geoserver/geoserver-2.22.2

# Expose port 8080 for GeoServer
EXPOSE 8080

# Set the default command to run GeoServer
CMD ["sh", "/opt/geoserver/geoserver-2.22.2/bin/start_geoserver.sh"]
