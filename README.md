# Flood Watch System


## Table of Contents
- [Introduction](#Introduction)
- [Getting Started](#GettingStarted)
- [ Build and Test](#BuildandTest)
- [Data Synchronization](#DataSynchronization)
- [Frontend Development (React)](#frontend-development-react)

# Introduction
 Django-based backend designed for flood_watch_system. 

# Getting Started
### Prerequisites
Ensure the following are installed on your system:
- Python 3.9+
- PostgreSQL with PostGIS extension
- Git and GitHub access
- GeoDjango dependencies (`GDAL`, `GEOS`, `PROJ`)
- GeoServer

# Build and Test
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

# Data Synchronization
To synchronize data from the flood model output server, ensure the remote server credentials are configured in the `.env` file, then run:
```bash
python manage.py sync_data
```

**Note:**: _Data synchronization is currently under development and may experience bugs when pushing to PostgreSQL._


# Frontend Development (React) 
The React frontend will integrate with the Django backend through RESTful APIs. 
Key Features:
- Impact assessment layers of FloodPROOFS 
- Interactive flood hazard maps

**Note:**: _Additional details coming soon, the front is still under initial stage of development._