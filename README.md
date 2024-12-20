# Flood Watch System

## Overview
The **Flood Watch System** is a robust, Django-based backend designed for monitoring and analyzing the socio-economic and environmental impacts of floods. It processes probabilistic model outputs, hazard maps, and near/real-time monitoring data to deliver actionable insights.

## Developed Models
 These models are capable of receiving and processing data in the local database. The models represent the impacts of flooding on various sectors. 
 The models that have been tested and are ready for frontend integration include:

1. **Affected Population**: Estimates the number of people affected by flooding.
2. **Impacted GDP**: Calculates the economic impact of floods on the region's GDP.
3. **Affected Crops**: Assesses the impact of flooding on agricultural sectors.
4. **Affected Roads**: Evaluates the damage to infrastructure, particularly roads.
5. **Displaced Population**: Identifies the number of people displaced by flooding.
6. **Affected Livestock**: Tracks the number of livestock affected by flooding.
7. **Affected Grazing Land**: Assesses the loss of grazing land due to floods.
_All of this is at the Admin 2 level of the member states_

## Hazard Maps
_Additional details coming soon._

## Alerts 
_Additional details coming soon._

## Technologies
- **Framework**: Django (Python)
- **Database**: PostgreSQL with PostGIS (for spatial data)
- **Web Map Management**: GeoServer

## Getting Started

### Prerequisites
Ensure the following are installed on your system:
- Python 3.9+
- PostgreSQL with PostGIS extension
- Git and GitHub access
- GeoDjango dependencies (`GDAL`, `GEOS`, `PROJ`)
- GeoServer

### Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/icpac-igad/flood_watch_system.git
    cd flood_watch_system
    ```

2. Set up a virtual environment:
    - **Windows:**
      ```bash
      python -m venv env
      env\Scripts\activate
      ```
    - **Linux/macOS:**
      ```bash
      python3 -m venv env
      source env/bin/activate
      ```

3. Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

4. Configure environment variables:
    Create a `.env` file in the root directory and add your configuration:
    ```plaintext
    SECRET_KEY=your_secret_key
    DATABASE_URL=postgres://user:password@localhost:5432/flood_watch
    ```

5. Install required system libraries (e.g., for GeoDjango):
    - **Linux (Ubuntu/Debian):**
      ```bash
      sudo apt install gdal-bin libgdal-dev libproj-dev
      ```
    - **Windows:**  
      On Windows, you may need to manually install the required libraries, such as GDAL, by following the instructions on the [GeoDjango installation guide](https://docs.djangoproject.com/en/stable/ref/contrib/gis/install/#gdal).

6. Run migrations:
    ```bash
    python manage.py makemigrations
    python manage.py migrate
    ```

7. Start the development server:
    ```bash
    python manage.py runserver
    ```

### Data Synchronization
To synchronize data from the flood model output server, ensure the remote server credentials are configured in the `.env` file, then run:
```bash
python manage.py sync_remote_data
```

_Note: Data synchronization is currently under development and may experience bugs when pushing to PostgreSQL._
```
