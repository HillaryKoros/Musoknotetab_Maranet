FROM camptocamp/mapserver:7.6

# Set environment variables
ENV MS_MAPFILE=/etc/mapserver/master.map
ENV PROJ_LIB=/usr/share/proj

# Install additional dependencies
RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    curl \
    gdal-bin \
    python3-gdal \
    apache2 \
    libapache2-mod-fcgid \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Configure Apache
RUN a2enmod cgid rewrite fcgid && \
    echo "ServerName localhost" >> /etc/apache2/apache2.conf && \
    mkdir -p /var/www/html/ms_tmp/ && \
    chown -R www-data:www-data /var/www/html/ms_tmp/ && \
    chmod -R 777 /var/www/html/ms_tmp/

# Copy Apache configuration for MapServer
COPY apache-mapserver.conf /etc/apache2/sites-available/000-default.conf

# Create necessary directories
RUN mkdir -p /data/shapefiles/admin \
    && mkdir -p /etc/mapserver/templates

# Create a minimal feature info template
RUN echo '<html><head><title>Feature Info</title></head><body>[item name=*]</body></html>' > /etc/mapserver/templates/feature_info.html

# Create a fonts file (required by MapServer)
RUN echo "sans /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf" > /etc/mapserver/fonts.txt

# Create an empty GeoJSON placeholder
RUN echo '{"type":"FeatureCollection","features":[]}' > /data/shapefiles/admin/empty.geojson

# Set correct permissions
RUN chmod -R 755 /data /etc/mapserver

# Expose MapServer port
EXPOSE 80

# Set the working directory
WORKDIR /data

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl --fail http://localhost/cgi-bin/mapserv?map=/etc/mapserver/master.map&SERVICE=WMS&REQUEST=GetCapabilities || exit 1

# Set entrypoint to run Apache
CMD ["apache2ctl", "-D", "FOREGROUND"]