# Flood Impact Maps

This project focuses on developing a full-stack solution for visualizing flood impact data and Hazard Maps. The architecture integrates automated data fetching, a backend API, and a React frontend for interactive visualization. The development environment uses Docker, VS Code.

## Table of Contents
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [Daily Milestones](#daily-milestones)
- [Technologies Used](#technologies-used)
- [Development Workflow](#development-workflow)

## Project Structure
```plaintext

```

## Setup Instructions

### Prerequisites
- **VS Code**
- **Windows System** 
- **Docker Desktop for Windows**

### Clone the Repository
```bash
git clone <repository_url>
cd flood-watch-system
```

### Initialize Docker Compose
1. Ensure Docker is installed and running.
2. Build and spin up the services:
   ```bash
   docker-compose up --build
   ```
3. Confirm the following:
   - PostgreSQL is running on `localhost:5432`.
   - GeoServer is accessible at `http://localhost:8080/geoserver`.

### Update Environment Variables
Create a `.env` file in the project root to configure sensitive data like database credentials and API keys.

```plaintext
POSTGRES_USER=user
POSTGRES_PASSWORD=password
POSTGRES_DB=flood_db
REMOTE_HOST=remote-server-ip
REMOTE_USER=username
REMOTE_PASSWORD=password
```

## Daily Milestones

### Day 1: Set Up the Core Environment
1. Organize the folder structure.
2. Create `docker-compose.yml` with services for PostgreSQL, GeoServer, backend, and frontend.
3. Verify that all containers are running correctly.

### Day 2: Automate Data Fetching Pipeline
1. Write a Python script (`scripts/fetch_data.py`) to fetch data from a remote server and save it to the PostgreSQL database.
2. Schedule the script to run hourly using cron in the backend container.

### Day 3: Backend API for Data Querying
1. Add Django REST Framework-based API endpoints for querying flood data.
2. Implement date-based queries in the backend.
3. Test the API using curl or Postman.

### Day 4: Frontend Integration
1. Create a React frontend for visualizing flood data.
2. Use a date picker to allow users to select a date.
3. Fetch and display data from the backend API.
4. Render the data on a Leaflet map.

### Day 5–7: Testing and Refinement
1. Test the end-to-end pipeline.
2. Add error handling and fallback mechanisms.
3. Enhance the frontend with map layers and tooltips.
4. Finalize the MVP for deployment.

## Technologies Used
- **Backend**: Wagtail, Django REST Framework, PostgreSQL with PostGIS
- **Frontend**: React, React-Leaflet, Axios
- **Data Fetching**: Python, Paramiko
- **Containerization**: Docker, Docker Compose
- **Development Environment**: VS Code, Ubuntu WSL 1

## Development Workflow

### Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Run migrations and start the server:
   ```bash
   python manage.py migrate
   python manage.py runserver
   ```

### Frontend
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies and start the development server:
   ```bash
   npm install
   npm start
   ```

### Data Fetching
1. Execute the data-fetching script manually:
   ```bash
   python scripts/fetch_data.py
   ```
2. Verify the fetched data in the PostgreSQL database.

### API Testing
1. Test API endpoints using curl:
   ```bash
   curl http://localhost:8000/api/flood-data/<date>/
   ```

---

Happy Developing! 🚀
