FROM debian:bullseye-slim

# Install MapServer and dependencies
RUN apt-get update && apt-get install -y \
    mapserver-bin \
    apache2 \
    libapache2-mod-fcgid \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Configure Apache for MapServer
RUN mkdir -p /etc/mapserver/data /mapfiles /var/www/html/mapfiles

# Copy Apache config for MapServer
COPY mapserver.conf /etc/apache2/sites-available/mapserver.conf
RUN ln -s /etc/apache2/sites-available/mapserver.conf /etc/apache2/sites-enabled/mapserver.conf

# Enable CGI modules (added for MapServer support)
RUN a2enmod fcgid
RUN a2enmod cgi
RUN a2enmod cgid

# Create symlink to the MapServer CGI executable (critical fix)
RUN ln -sf /usr/bin/mapserv /usr/lib/cgi-bin/mapserv
RUN chmod 755 /usr/lib/cgi-bin/mapserv

# Ensure proper permissions
RUN chmod -R 755 /etc/mapserver/data /mapfiles

# Make mapfiles symlink in public HTML directory
RUN ln -s /mapfiles /var/www/html/mapfiles

# Create a test HTML file for debugging
RUN echo "<html><body><h1>MapServer is installed</h1></body></html>" > /var/www/html/mapserver-test.html

# Start Apache
CMD ["apache2ctl", "-D", "FOREGROUND"]

# Expose port 80
EXPOSE 80