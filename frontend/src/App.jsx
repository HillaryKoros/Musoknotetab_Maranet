import React, { useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Popup } from 'react-leaflet';
import { Alert, Spinner, Form, ListGroup, Navbar, Container, Nav } from 'react-bootstrap';
import './App.css';

const MapWithNavbar = () => {
  const position = [4.6818, 34.9911];
  const zoom = 5;

  // URLs for your layers
  const layerURLs = {
    affectedPop: "http://127.0.0.1:8000/affectedPop/",
    affectedGDP: "http://127.0.0.1:8000/affectedGDP/",
    affectedCrops: "http://127.0.0.1:8000/affectedCrops/",
    affectedRoads: "http://127.0.0.1:8000/affectedRoads/",
    displacedPop: "http://127.0.0.1:8000/displacedPop/",
    affectedLivestock: "http://127.0.0.1:8000/affectedLivestock/",
    affectedGrazingLand: "http://127.0.0.1:8000/affectedGrazingLand/",
  };

  const [selectedLayers, setSelectedLayers] = useState({});
  const [loadingLayers, setLoadingLayers] = useState([]);
  const [error, setError] = useState(null);

  const fetchLayerData = async (layerKey) => {
    try {
      const response = await fetch(layerURLs[layerKey]);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching layer:", error);
      throw error;
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
        const data = await fetchLayerData(layerKey);
        setSelectedLayers((prev) => ({
          ...prev,
          [layerKey]: data
        }));
      } catch (error) {
        setError(`Failed to load ${layerKey}: ${error.message}`);
      } finally {
        setLoadingLayers((prev) => prev.filter(key => key !== layerKey));
      }
    }
  };

  return (
    <div className="app-wrapper">
      {/* Navigation Bar */}
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
        {/* Sidebar */}
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

        {/* Map Container */}
        <div className="map-container">
          <MapContainer
            center={position}
            zoom={zoom}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {Object.entries(selectedLayers).map(([key, data]) => (
              <GeoJSON key={key} data={data}>
                <Popup>
                  <strong>{key}</strong>
                  <p>Layer data loaded successfully</p>
                </Popup>
              </GeoJSON>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default MapWithNavbar;