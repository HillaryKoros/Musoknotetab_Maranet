import React, { useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Popup } from 'react-leaflet';
import { Alert, Spinner, Form, ListGroup, Navbar, Container, Nav } from 'react-bootstrap';
import './App.css';

const MapWithNavbar = () => {
  const position = [4.6818, 34.9911];
  const zoom = 5;

  const layerURLs = {
    affectedPop: "http://127.0.0.1:8000//api/api/affectedPop/",
    affectedGDP: "http://127.0.0.1:8000//api/api/affectedGDP/",
    affectedCrops: "http://127.0.0.1:8000//api/api/affectedCrops/",
    affectedRoads: "http://127.0.0.1:8000//api/api/affectedRoads/",
    displacedPop: "http://127.0.0.1:8000//api/api/displacedPop/",
    affectedLivestock: "http://127.0.0.1:8000//api/api/affectedLivestock/",
    affectedGrazingLand: "http://127.0.0.1:8000//api/api/affectedGrazingLand/",
  };

  const [selectedLayers, setSelectedLayers] = useState({});
  const [loadingLayers, setLoadingLayers] = useState([]);
  const [error, setError] = useState(null);

  const fetchLayerData = async (layerKey) => {
    try {
      console.log(`Fetching ${layerKey} from ${layerURLs[layerKey]}`);
      
      const response = await fetch(layerURLs[layerKey], {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Received data for ${layerKey}:`, data);
      
      // Check if we received valid GeoJSON
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data received');
      }
      
      return data;
    } catch (error) {
      console.error(`Error fetching ${layerKey}:`, error);
      throw new Error(`Failed to fetch ${layerKey}: ${error.message}`);
    }
  };

  const handleLayerToggle = async (layerKey) => {
    if (selectedLayers[layerKey]) {
      setSelectedLayers((prev) => {
        const updated = { ...prev };
        delete updated[layerKey];
        return updated;
      });
    } else {
      setLoadingLayers((prev) => [...prev, layerKey]);
      setError(null);
      
      try {
        console.log(`Starting to load ${layerKey}`);
        const data = await fetchLayerData(layerKey);
        console.log(`Successfully loaded ${layerKey}`, data);
        
        setSelectedLayers((prev) => ({
          ...prev,
          [layerKey]: data
        }));
      } catch (error) {
        console.error(`Error in handleLayerToggle for ${layerKey}:`, error);
        setError(`Failed to load ${layerKey}: ${error.message}`);
      } finally {
        setLoadingLayers((prev) => prev.filter(key => key !== layerKey));
      }
    }
  };

  return (
    <div className="app-wrapper">
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand href="#home">GIS Dashboard</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link href="#home">Home</Nav.Link>
              <Nav.Link href="#about">About</Nav.Link>
              <Nav.Link href="#contact">Contact</Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <div className="app-container">
        <div className="sidebar">
          <h4>Layers</h4>
          
          {error && (
            <Alert variant="danger" className="mb-3">
              {error}
            </Alert>
          )}

          <ListGroup>
            {Object.keys(layerURLs).map((key) => (
              <ListGroup.Item key={key}>
                <Form.Check
                  type="checkbox"
                  label={key}
                  checked={!!selectedLayers[key]}
                  onChange={() => handleLayerToggle(key)}
                  disabled={loadingLayers.includes(key)}
                />
                {loadingLayers.includes(key) && (
                  <Spinner animation="border" size="sm" className="ms-2" />
                )}
              </ListGroup.Item>
            ))}
          </ListGroup>
        </div>

        <div className="map-container">
          <MapContainer
            center={position}
            zoom={zoom}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {Object.entries(selectedLayers).map(([key, data]) => {
              console.log(`Rendering layer ${key}:`, data);
              return (
                <GeoJSON 
                  key={key} 
                  data={data}
                  style={() => ({
                    fillColor: '#3388ff',
                    weight: 2,
                    opacity: 1,
                    color: 'white',
                    dashArray: '3',
                    fillOpacity: 0.7
                  })}
                  onEachFeature={(feature, layer) => {
                    if (feature.properties) {
                      layer.bindPopup(`
                        <div>
                          <h4>${key}</h4>
                          <pre>${JSON.stringify(feature.properties, null, 2)}</pre>
                        </div>
                      `);
                    }
                  }}
                />
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default MapWithNavbar;