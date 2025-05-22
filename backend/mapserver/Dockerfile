FROM debian:bullseye-slim

# Install necessary packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    apache2 \
    cgi-mapserver \
    mapserver-bin \
    libapache2-mod-fcgid \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Enable necessary Apache modules
RUN a2enmod cgi fcgid rewrite

# Copy configuration files
COPY conf/apache.conf /etc/apache2/sites-available/000-default.conf

# Create necessary directories with proper permissions
RUN mkdir -p /var/www/html/cgi-bin \
    && mkdir -p /var/www/html/mapfiles \
    && mkdir -p /etc/mapserver/data/vector \
    && mkdir -p /etc/mapserver/data/raster \
    && mkdir -p /etc/mapserver/data/timeseries \
    && chmod 755 /var/www/html/cgi-bin \
    && chmod 755 /var/www/html/mapfiles \
    && chmod 777 /etc/mapserver/data \
    && chmod 777 /etc/mapserver/data/vector \
    && chmod 777 /etc/mapserver/data/raster \
    && chmod 777 /etc/mapserver/data/timeseries

# Copy mapserver executable to cgi-bin
RUN ln -sf /usr/lib/cgi-bin/mapserv /var/www/html/cgi-bin/mapserv
RUN chmod 755 /var/www/html/cgi-bin/mapserv

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set the working directory
WORKDIR /var/www/html

# Expose port 80
EXPOSE 80

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]