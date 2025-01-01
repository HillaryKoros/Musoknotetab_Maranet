import React, { useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, LayersControl } from 'react-leaflet';
import { Alert, Spinner, Form, ListGroup } from 'react-bootstrap';
import 'leaflet/dist/leaflet.css';

const { BaseLayer } = LayersControl;

const MapViewer = () => {
  const position = [4.6818, 34.9911];
  const zoom = 5;

  const layerURLs = {
    affectedPop: 'http://127.0.0.1:8000/api/affectedPop/',
    affectedGDP: 'http://127.0.0.1:8000/api/affectedGDP/',
    affectedCrops: 'http://127.0.0.1:8000/api/affectedCrops/',
    affectedRoads: 'http://127.0.0.1:8000/api/affectedRoads/',
    displacedPop: 'http://127.0.0.1:8000/api/displacedPop/',
    affectedLivestock: 'http://127.0.0.1:8000/api/affectedLivestock/',
    affectedGrazingLand: 'http://127.0.0.1:8000/api/affectedGrazingLand/',
  };

  const basemaps = [
    {
      name: 'OpenStreetMap',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
    },
    {
      name: 'Satellite',
      url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
    },
    {
      name: 'Topographic',
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenTopoMap contributors',
    },
  ];

  const [selectedLayer, setSelectedLayer] = useState(null);
  const [loadingLayer, setLoadingLayer] = useState(null);
  const [error, setError] = useState(null);

  // Reuse the same color and style functions from the original code
  const breaks = [-1, 0, 5, 10, 20];
  const getFloodColor = (flood_tot) => {
    if (flood_tot < 0) return 'transparent';
    if (flood_tot >= 20) return '#f86c31';
    if (flood_tot >= 10) return '#fda649';
    if (flood_tot >= 5) return '#fed66d';
    if (flood_tot > 0) return '#ffffb2';
    return 'transparent';
  };

  const getGeoJsonStyle = (feature) => {
    const flood_tot = feature.properties?.flood_tot || 0;
    return {
      fillColor: flood_tot <= 0 ? 'transparent' : getFloodColor(flood_tot),
      fillOpacity: flood_tot <= 0 ? 0 : 0.7,
      weight: 2,
      color: 'black',
    };
  };

  const fetchLayerData = async (layerKey) => {
    try {
      const response = await fetch(layerURLs[layerKey]);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (!data || typeof data !== 'object') throw new Error('Invalid data received');
      return data;
    } catch (error) {
      throw new Error(`Failed to fetch ${layerKey}: ${error.message}`);
    }
  };

  const handleLayerToggle = async (layerKey) => {
    if (selectedLayer === layerKey) {
      setSelectedLayer(null);
    } else {
      setLoadingLayer(layerKey);
      setError(null);

      try {
        const data = await fetchLayerData(layerKey);
        setSelectedLayer({ key: layerKey, data });
      } catch (error) {
        setError(`Failed to load ${layerKey}: ${error.message}`);
      } finally {
        setLoadingLayer(null);
      }
    }
  };

  return (
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
                type="radio"
                name="layer"
                label={key}
                checked={selectedLayer?.key === key}
                onChange={() => handleLayerToggle(key)}
                disabled={loadingLayer === key}
              />
              {loadingLayer === key && (
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
          style={{ height: '100%', width: '100%' }}
        >
          <LayersControl position="topright">
            {basemaps.map((basemap, index) => (
              <BaseLayer key={index} name={basemap.name}>
                <TileLayer url={basemap.url} attribution={basemap.attribution} />
              </BaseLayer>
            ))}
          </LayersControl>
          {selectedLayer && (
            <GeoJSON
              data={selectedLayer.data}
              style={getGeoJsonStyle}
              onEachFeature={(feature, layer) => {
                if (feature.properties) {
                  layer.bindPopup(`
                    <div>
                      <h4>${selectedLayer.key}</h4>
                      <pre>${JSON.stringify(feature.properties, null, 2)}</pre>
                    </div>
                  `);
                }
              }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default MapViewer;