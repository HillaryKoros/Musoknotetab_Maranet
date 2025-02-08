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

# Set the working directory
WORKDIR /app

# Copy requirements first
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . /app/

# Create directories and set permissions
RUN mkdir -p /app/data && \
    mkdir -p /app/staticfiles && \
    mkdir -p /app/mediafiles && \
    chmod -R 777 /app/data

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=flood_watch_system.settings

EXPOSE 8000

CMD ["gunicorn", "flood_watch_system.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]