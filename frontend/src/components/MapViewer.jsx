import React, { useState } from 'react';
import { MapContainer, TileLayer, WMSTileLayer } from 'react-leaflet';
import { Form, ListGroup } from 'react-bootstrap';
import 'leaflet/dist/leaflet.css';

const MapViewer = () => {
  const position = [4.6818, 34.9911];
  const zoom = 5;

  const geoserverWMSUrl = "http://localhost:8080/geoserver/floodwatch/wms";

  // Impact Layers Configuration
  const impactLayers = [
    {
      name: 'Affected Population',
      layer: 'floodwatch:Impact_affectedpopulation',
      legend: `${geoserverWMSUrl}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=floodwatch:Impact_affectedpopulation`,
    },
    {
      name: 'Affected GDP',
      layer: 'floodwatch:Impact_impactedgdp',
      legend: `${geoserverWMSUrl}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=floodwatch:Impact_impactedgdp`,
    },
    {
      name: 'Affected Crops',
      layer: 'floodwatch:Impact_affectedcrops',
      legend: `${geoserverWMSUrl}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=floodwatch:Impact_affectedcrops`,
    },
    {
      name: 'Affected Roads',
      layer: 'floodwatch:Impact_affectedroads',
      legend: `${geoserverWMSUrl}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=floodwatch:Impact_affectedroads`,
    },
    {
      name: 'Displaced Population',
      layer: 'floodwatch:Impact_displacedpopulation',
      legend: `${geoserverWMSUrl}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=floodwatch:Impact_displacedpopulation`,
    },
    {
      name: 'Affected Livestock',
      layer: 'floodwatch:Impact_affectedlivestock',
      legend: `${geoserverWMSUrl}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=floodwatch:Impact_affectedlivestock`,
    },
    {
      name: 'Affected Grazing Land',
      layer: 'floodwatch:Impact_affectedgrazingland',
      legend: `${geoserverWMSUrl}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=floodwatch:Impact_affectedgrazingland`,
    },
  ];

  // Hazard and Alerts Configuration
  const hazardAndAlertLayers = [
    {
      name: 'Flood Hazard Map',
      layer: 'floodwatch:flood_hazard_map_floodproofs_202501030000',
      legend: `${geoserverWMSUrl}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=floodwatch:flood_hazard_map_floodproofs_202501030000`,
    },
    {
      name: 'Flood Alerts',
      layer: 'floodwatch:Alerts',
      legend: `${geoserverWMSUrl}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=floodwatch:Alerts`,
    },
  ];

  // Base Maps Configuration
  const basemaps = [
    {
      name: 'OpenStreetMap',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
    },
    {
      name: 'Satellite',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; ESRI, Maxar',
    },
    {
      name: 'Topographic',
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenTopoMap contributors',
    },
  ];

  /* REST API Configuration 
  const restApiEndpoints = {
    affectedPop: 'http://127.0.0.1:8000/api/affectedPop/',
    affectedGDP: 'http://127.0.0.1:8000/api/affectedGDP/',
    affectedCrops: 'http://127.0.0.1:8000/api/affectedCrops/',
    affectedRoads: 'http://127.0.0.1:8000/api/affectedRoads/',
    displacedPop: 'http://127.0.0.1:8000/api/displacedPop/',
    affectedLivestock: 'http://127.0.0.1:8000/api/affectedLivestock/',
    affectedGrazingLand: 'http://127.0.0.1:8000/api/affectedGrazingLand/',
  };
  */

  const [selectedLayer, setSelectedLayer] = useState(null);
  const [activeLegend, setActiveLegend] = useState(null);
  const [baseMap, setBaseMap] = useState(basemaps[0]);
  

  const handleLayerSelection = (layer) => {
    // Clear current layer
    setSelectedLayer(null);
    
    // Short timeout to ensure layer switch
    setTimeout(() => {
      setSelectedLayer(layer.layer);
      setActiveLegend(layer.legend);
    }, 100);
  };

  const handleBaseMapChange = (baseMapIndex) => {
    setBaseMap(basemaps[baseMapIndex]);
  };

  /* REST API Implementation 
  const fetchRestApiData = async (endpoint) => {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch data');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching REST API data:', error);
      return null;
    }
  };
  */

  return (
    <div className="app-container">
      <div className="sidebar">
        {/* Impact Layers Section */}
        <h4>Impact Layers</h4>
        <ListGroup className="mb-4">
          {impactLayers.map((layer) => (
            <ListGroup.Item key={layer.name}>
              <Form.Check
                type="radio"
                name="layerSelection"
                label={layer.name}
                onChange={() => handleLayerSelection(layer)}
                checked={selectedLayer === layer.layer}
              />
            </ListGroup.Item>
          ))}
        </ListGroup>

        {/* Hazard and Alert Layers Section */}
        <h4>Hazard & Alert Maps</h4>
        <ListGroup className="mb-4">
          {hazardAndAlertLayers.map((layer) => (
            <ListGroup.Item key={layer.name}>
              <Form.Check
                type="radio"
                name="layerSelection"
                label={layer.name}
                onChange={() => handleLayerSelection(layer)}
                checked={selectedLayer === layer.layer}
              />
            </ListGroup.Item>
          ))}
        </ListGroup>

        {/* Base Maps Section */}
        <h4>Base Maps</h4>
        <ListGroup>
          {basemaps.map((basemap, index) => (
            <ListGroup.Item key={basemap.name}>
              <Form.Check
                type="radio"
                name="basemapSelection"
                label={basemap.name}
                onChange={() => handleBaseMapChange(index)}
                checked={baseMap === basemap}
              />
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
          <TileLayer url={baseMap.url} attribution={baseMap.attribution} />

          {selectedLayer && (
            <WMSTileLayer
              key={selectedLayer}
              url={geoserverWMSUrl}
              layers={selectedLayer}
              format="image/png"
              transparent={true}
              attribution="GeoServer Floodwatch"
            />
          )}
        </MapContainer>

        {activeLegend && (
          <div
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '20px',
              background: 'white',
              padding: '10px',
              borderRadius: '8px',
              boxShadow: '0px 0px 10px rgba(0,0,0,0.3)',
              zIndex: 1000,
            }}
          >
            <h5>Legend</h5>
            <img src={activeLegend} alt="Legend" style={{ width: '100%' }} />
          </div>
        )}
      </div>
    </div>
  );
};

export default MapViewer;