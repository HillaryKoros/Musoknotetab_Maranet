# Use Python 3.12 slim image as base
FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gdal-bin \
    libgdal-dev \
    libpq-dev \
    gcc \
    make \
    && rm -rf /var/lib/apt/lists/*

# Set GDAL environment variables
ENV GDAL_LIBRARY_PATH=/usr/lib/x86_64-linux-gnu/libgdal.so \
    GDAL_DATA=/usr/share/gdal

# Create a non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set the working directory
WORKDIR /app

# Copy application files
COPY . /app/

# Copy the requirements.txt and install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=flood_watch_system.settings

# Change ownership of the application files to non-root user
RUN chown -R appuser:appuser /app

# Switch to the non-root user
USER appuser

# Healthcheck for container
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health/ || exit 1

# Expose port 8000
EXPOSE 8000

# Default command to run the Django application
CMD ["gunicorn", "flood_watch_system.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
