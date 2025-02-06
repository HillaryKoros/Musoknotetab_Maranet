import React, { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, useMapEvents, useMap, LayersControl, GeoJSON, Popup } from 'react-leaflet';
import { Form, ListGroup } from 'react-bootstrap';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend as RechartsLegend, ResponsiveContainer } from 'recharts';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

/********************************************************************************
 * MAP CONFIGURATION
 *******************************************************************************/
const MAP_CONFIG = {
  initialPosition: [4.6818, 34.9911],
  initialZoom: 5,
  geoserverWMSUrl: "http://127.0.0.1:8093/geoserver/floodwatch/wms",
  getFeatureInfoFormat: 'application/json',
  popupWidth: 300,
  popupMaxHeight: 400,
  popupOffset: [0, -10]
};

const MONITORING_STATIONS_CONFIG = {
  name: 'Monitoring Stations',
  style: {
    radius: 8,
    fillColor: "#3388ff",
    color: "#fff",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8,
    selectedFillColor: "#ff4444"
  }
};

/********************************************************************************
 * LAYER CONFIGURATION
 *******************************************************************************/
const createWMSLayer = (name, layerId, queryable = true) => ({
  name,
  layer: `floodwatch:${layerId}`,
  legend: `${MAP_CONFIG.geoserverWMSUrl}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=floodwatch:${layerId}`,
  queryable
});

const HAZARD_LAYERS = [
  createWMSLayer('Inundation Map', 'flood_hazard_20250204'),
  createWMSLayer('Alerts Map', 'Alerts')
];

const IMPACT_LAYERS = [
  createWMSLayer('Affected Population', 'Impact_affectedpopulation'),
  createWMSLayer('Affected GDP', 'Impact_impactedgdp'),
  createWMSLayer('Affected Crops', 'Impact_affectedcrops'),
  createWMSLayer('Affected Roads', 'Impact_affectedroads'),
  createWMSLayer('Displaced Population', 'Impact_displacedpopulation'),
  createWMSLayer('Affected Livestock', 'Impact_affectedlivestock'),
  createWMSLayer('Affected Grazing Land', 'Impact_affectedgrazingland'),
  createWMSLayer('SectorData', 'Impact_sectordata')
];

const BOUNDARY_LAYERS = [
  createWMSLayer('Admin 1', 'gha_admin1'),
  createWMSLayer('Admin 2', 'gha_admin2'),
  createWMSLayer('Protected Areas', 'protected_areas')
];

const BASE_MAPS = [
  {
    name: 'ICPAC',
    url: 'https://eahazardswatch.icpac.net/tileserver-gl/styles/droughtwatch/{z}/{x}/{y}.png',
    attribution: '&copy; ICPAC_FloodWatch'
  },
  {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors'
  },
  {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; ESRI, Maxar'
  },
  {
    name: 'Topographic',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap contributors'
  }
];

/********************************************************************************
 * STATION INFO COMPONENT
 *******************************************************************************/
const StationInfo = ({ feature }) => {
  if (!feature?.properties) return null;
  const props = feature.properties;

  return (
    <div className="station-info-overlay">
      <h5>{props.SEC_NAME}</h5>
      <div className="station-details">
        <div><strong>Basin:</strong> {props.BASIN}</div>
        <div><strong>Area:</strong> {`${props.AREA} km²`}</div>
        <div><strong>Location:</strong> {`${props.latitude?.toFixed(4)}°N, ${props.longitude?.toFixed(4)}°E`}</div>
      </div>
      
      <div className="threshold-info">
        <div className="alert">
          <strong>Alert:</strong> {props.Q_THR1} m³/s
        </div>
        <div className="alarm">
          <strong>Alarm:</strong> {props.Q_THR2} m³/s
        </div>
        <div className="emergency">
          <strong>Emergency:</strong> {props.Q_THR3} m³/s
        </div>
      </div>
    </div>
  );
};

/********************************************************************************
 * DISCHARGE CHART COMPONENT
 *******************************************************************************/
const DischargeChart = ({ timeSeriesData }) => {
  if (!timeSeriesData || timeSeriesData.length === 0) return null;

  return (
    <div className="discharge-chart">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart
          data={timeSeriesData}
          margin={{ top: 5, right: 20, left: 40, bottom: 35 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10 }}
            angle={-45}
            textAnchor="end"
            height={60}
            interval={0}
          />
          <YAxis
            label={{ 
              value: 'Discharge (m³/s)',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 12 }
            }}
          />
          <Tooltip 
            formatter={(value) => [`${value.toFixed(2)} m³/s`]}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <RechartsLegend
            verticalAlign="bottom"
            height={36}
            wrapperStyle={{
              paddingTop: '10px',
              paddingBottom: '10px',
              borderTop: '1px solid #eee'
            }}
          />
          <Line
            type="monotone"
            dataKey="gfs"
            stroke="#4169E1"
            name="GFS Forecast"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="icon"
            stroke="#32CD32"
            name="ICON Forecast"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

/********************************************************************************
 * LAYER SELECTOR COMPONENT
 *******************************************************************************/
const LayerSelector = ({ title, layers, selectedLayers, onLayerSelect }) => (
  <div className="layer-selector">
    <h4>{title}</h4>
    <ListGroup className="mb-4">
      {layers.map((layer) => (
        <ListGroup.Item key={layer.name} className="layer-item">
          <Form.Check
            type="checkbox"
            name="layerSelection"
            id={`layer-${layer.name}`}
            label={layer.name}
            onChange={() => onLayerSelect(layer)}
            checked={selectedLayers.has(layer.layer)}
          />
        </ListGroup.Item>
      ))}
    </ListGroup>
  </div>
);

/********************************************************************************
 * MAP LEGEND COMPONENT
 *******************************************************************************/
const MapLegend = ({ legendUrl }) => (
  <div className="map-legend">
    <h5>Legend</h5>
    <img src={legendUrl} alt="Legend" onError={(e) => e.target.style.display = 'none'} />
  </div>
);

/********************************************************************************
 * FEATURE POPUP COMPONENT
 *******************************************************************************/
const FeaturePopup = ({ feature }) => {
  if (!feature?.properties) return null;

  return (
    <Popup>
      <div className="feature-popup">
        {Object.entries(feature.properties)
          .filter(([key]) => !key.startsWith('_'))
          .map(([key, value]) => (
            <div key={key} className="popup-row">
              <strong>{key}:</strong> {value}
            </div>
          ))}
      </div>
    </Popup>
  );
};

/********************************************************************************
 * MAP INTERACTION HANDLER
 *******************************************************************************/
const MapInteractionHandler = ({ selectedLayers, onFeatureClick }) => {
  const map = useMapEvents({
    click: async (e) => {
      if (!selectedLayers.size) return;

      const { lat, lng } = e.latlng;
      const bounds = map.getBounds();
      const size = map.getSize();
      const point = map.latLngToContainerPoint(e.latlng);

      try {
        const params = new URLSearchParams({
          REQUEST: 'GetFeatureInfo',
          SERVICE: 'WMS',
          VERSION: '1.1.1',
          LAYERS: Array.from(selectedLayers).join(','),
          QUERY_LAYERS: Array.from(selectedLayers).join(','),
          INFO_FORMAT: MAP_CONFIG.getFeatureInfoFormat,
          FEATURE_COUNT: '10',
          X: Math.round(point.x).toString(),
          Y: Math.round(point.y).toString(),
          BUFFER: '8',
          BBOX: bounds.toBBoxString(),
          WIDTH: size.x.toString(),
          HEIGHT: size.y.toString(),
          SRS: 'EPSG:4326'
        });

        const getFeatureInfoUrl = `${MAP_CONFIG.geoserverWMSUrl}?${params.toString()}`;
        const response = await fetch(getFeatureInfoUrl);
        
        if (!response.ok) throw new Error('GetFeatureInfo request failed');
        
        const data = await response.json();
        if (data.features?.length > 0) {
          onFeatureClick({
            location: { lat, lng },
            data: data.features
          });
        }
      } catch (error) {
        console.error('GetFeatureInfo error:', error);
      }
    }
  });

  return null;
};

/********************************************************************************
 * MAIN MAP VIEWER COMPONENT
 *******************************************************************************/
const MapViewer = () => {
  const [selectedLayers, setSelectedLayers] = useState(new Set());
  const [activeLegend, setActiveLegend] = useState(null);
  const [popupInfo, setPopupInfo] = useState(null);
  const [mapKey, setMapKey] = useState(0);
  const [showMonitoringStations, setShowMonitoringStations] = useState(false);
  const [monitoringData, setMonitoringData] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [showChart, setShowChart] = useState(false);

  useEffect(() => {
    if (showMonitoringStations) {
      fetch('merged_data.geojson')
        .then(response => response.json())
        .then(data => {
          data.features.forEach(feature => {
            const coords = feature.geometry.coordinates;
            feature.properties.latitude = coords[1];
            feature.properties.longitude = coords[0];
          });
          setMonitoringData(data);
        })
        .catch(error => console.error('Error loading monitoring data:', error));
    }
  }, [showMonitoringStations]);

  const handleLayerSelection = useCallback((layer) => {
    const newSelectedLayers = new Set(selectedLayers);

    if (newSelectedLayers.has(layer.layer)) {
      newSelectedLayers.delete(layer.layer);
    } else {
      newSelectedLayers.add(layer.layer);
    }

    if (IMPACT_LAYERS.some((impactLayer) => impactLayer.layer === layer.layer) &&
        layer.layer !== IMPACT_LAYERS.find((l) => l.name === 'SectorData')?.layer) {
      HAZARD_LAYERS.forEach((hazardLayer) => {
        newSelectedLayers.delete(hazardLayer.layer);
      });
      BOUNDARY_LAYERS.forEach((boundaryLayer) => {
        newSelectedLayers.delete(boundaryLayer.layer);
      });
      IMPACT_LAYERS.forEach((impactLayer) => {
        if (impactLayer.layer !== layer.layer) {
          newSelectedLayers.delete(impactLayer.layer);
        }
      });
    }

    if (HAZARD_LAYERS.some((hazardLayer) => hazardLayer.layer === layer.layer)) {
      IMPACT_LAYERS.forEach((impactLayer) => {
        if (impactLayer.layer !== IMPACT_LAYERS.find((l) => l.name === 'SectorData')?.layer) {
          newSelectedLayers.delete(impactLayer.layer);
        }
      });
    }

    setSelectedLayers(newSelectedLayers);
    setActiveLegend(newSelectedLayers.has(layer.layer) ? layer.legend : null);
    setPopupInfo(null);
    setMapKey(prev => prev + 1);
  }, [selectedLayers]);

  const handleFeatureClick = useCallback((info) => {
    setPopupInfo(info);
  }, []);

  const handleStationClick = (feature) => {
    setSelectedStation(feature);
    setShowChart(true);

    if (feature?.properties) {
      const { time_period, 'time_series_discharge_simulated-gfs': gfs, 'time_series_discharge_simulated-icon': icon } = feature.properties;
      
      try {
        const times = time_period.split(',');
        const gfsValues = gfs.split(',').map(Number);
        const iconValues = icon.split(',').map(Number);
        
        const data = times.map((time, i) => ({
          time: time.split(' ')[0],
          gfs: gfsValues[i],
          icon: iconValues[i]
        }));
        
        setTimeSeriesData(data.filter((_, index) => index % 6 === 0));
      } catch (error) {
        console.error('Error parsing time series data:', error);
      }
    }
  };

  const handleNonMonitoringClick = (feature, latlng) => {
    if (!feature?.properties) return;
    
    const popup = L.popup()
      .setLatLng(latlng)
      .setContent(
        `<div class="feature-popup">
          ${Object.entries(feature.properties)
            .filter(([key]) => !key.startsWith('_'))
            .map(([key, value]) => `<div class="popup-row"><strong>${key}:</strong> ${value}</div>`)
            .join('')}
        </div>`
      );
    
    popup.openOn(map);
  };

  return (
    <div className="map-viewer">
      <div className="sidebar">
        <LayerSelector
          title="Inundation Map"
          layers={HAZARD_LAYERS}
          selectedLayers={selectedLayers}
          onLayerSelect={handleLayerSelection}
        />

        <LayerSelector
          title="Impact Layers"
          layers={IMPACT_LAYERS}
          selectedLayers={selectedLayers}
          onLayerSelect={handleLayerSelection}
        />

        <LayerSelector
          title="Boundary Layers"
          layers={BOUNDARY_LAYERS}
          selectedLayers={selectedLayers}
          onLayerSelect={handleLayerSelection}
        />

        <div className="layer-selector">
          <h4>Additional Layers</h4>
          <ListGroup className="mb-4">
            <ListGroup.Item className="layer-item">
              <Form.Check
                type="checkbox"
                id="monitoring-stations-toggle"
                label="Monitoring Stations"
                onChange={() => setShowMonitoringStations(prev => !prev)}
                checked={showMonitoringStations}
              />
            </ListGroup.Item>
          </ListGroup>
        </div>
      </div>

      <div className="main-content">
        <div className="map-container">
          <MapContainer
            center={MAP_CONFIG.initialPosition}
            zoom={MAP_CONFIG.initialZoom}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <MapInteractionHandler
              selectedLayers={selectedLayers}
              onFeatureClick={handleFeatureClick}
            />

            <LayersControl position="topright">
              {BASE_MAPS.map((basemap) => (
                <LayersControl.BaseLayer
                  key={basemap.name}
                  name={basemap.name}
                  checked={basemap.name === 'ICPAC'}
                >
                  <TileLayer
                    url={basemap.url}
                    attribution={basemap.attribution}
                  />
                </LayersControl.BaseLayer>
              ))}

              {Array.from(selectedLayers).map((layer) => (
                <LayersControl.Overlay
                  key={layer}
                  checked={true}
                  name={layer.split(':')[1] || 'Custom Layer'}
                >
                  <WMSTileLayer
                    key={`wms-${mapKey}-${layer}`}
                    url={MAP_CONFIG.geoserverWMSUrl}
                    layers={layer}
                    format="image/png"
                    transparent={true}
                    attribution="GeoServer"
                    version="1.1.1"
                    eventHandlers={{
                      click: (e) => {
                        if (!showMonitoringStations) {
                          handleNonMonitoringClick(e.feature, e.latlng);
                        }
                      }
                    }}
                  />
                </LayersControl.Overlay>
              ))}

              {showMonitoringStations && monitoringData && (
                <GeoJSON
                  data={monitoringData}
                  pointToLayer={(feature, latlng) => 
                    L.circleMarker(latlng, {
                      ...MONITORING_STATIONS_CONFIG.style,
                      fillColor: selectedStation?.properties?.SEC_NAME === feature.properties.SEC_NAME 
                        ? MONITORING_STATIONS_CONFIG.style.selectedFillColor 
                        : MONITORING_STATIONS_CONFIG.style.fillColor
                    })
                  }
                  onEachFeature={(feature, layer) => {
                    layer.on({
                      click: () => handleStationClick(feature)
                    });
                  }}
                />
              )}
            </LayersControl>
          </MapContainer>

          {selectedStation && (
            <StationInfo feature={selectedStation} />
          )}

          {activeLegend && <MapLegend legendUrl={activeLegend} />}
        </div>

        {showChart && (
          <div className="bottom-panel">
            <div className="chart-header">
              <h5>{selectedStation?.properties?.SEC_NAME || 'Discharge Chart'}</h5>
              <button 
                className="close-button"
                onClick={() => {
                  setShowChart(false);
                  setSelectedStation(null);
                }}
              >
                ×
              </button>
            </div>
            <DischargeChart timeSeriesData={timeSeriesData} />
          </div>
        )}
      </div>

      <style jsx global>{`
        .map-viewer {
          display: flex;
          height: calc(100vh - 160px);
          width: 100%;
          position: relative;
          overflow: hidden;
        }

        .sidebar {
          width: 300px;
          padding: 20px;
          background-color: #f8f9fa;
          overflow-y: auto;
          box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
          height: 100%;
          z-index: 1000;
        }

        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .map-container {
          flex: 1;
          position: relative;
          height: 100%;
        }

        .bottom-panel {
          height: 250px;
          background: white;
          border-top: 1px solid #ddd;
          padding: 10px;
          box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.1);
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          padding: 0 10px;
        }

        .chart-container {
          height: 200px;
        }

        .close-button {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          padding: 0 8px;
          color: #666;
        }

        .close-button:hover {
          color: #333;
        }

        .station-info-overlay {
          position: absolute;
          top: 20px;
          right: 20px;
          background: white;
          padding: 15px;
          border-radius: 8px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          z-index: 1000;
          max-width: 500px;
        }

        .station-details {
          margin: 10px 0;
        }

        .alert, .alarm, .emergency {
          padding: 5px;
          margin: 3px 0;
          border-radius: 4px;
        }

        .alert { background: #fff3cd; }
        .alarm { background: #ffe5e5; }
        .emergency { background: #ffcccc; }

        .map-legend {
          position: absolute;
          bottom: 40px;
          left: 20px;
          background: white;
          padding: 10px;
          border-radius: 8px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
          z-index: 1000;
          max-height: calc(100vh - 260px);
          overflow-y: auto;
        }

        .layer-selector h4 {
          margin-bottom: 12px;
          color: #333;
        }

        .layer-item {
          padding: 8px 12px;
          border: 1px solid #dee2e6;
          margin-bottom: 4px;
          border-radius: 4px;
        }

        .layer-item:hover {
          background-color: #f8f9fa;
        }

        .feature-popup {
          padding: 10px;
          max-height: 300px;
          overflow-y: auto;
        }

        .popup-row {
          margin-bottom: 5px;
          font-size: 12px;
        }

        .discharge-chart {
          padding: 10px;
          background: white;
          border-radius: 4px;
        }

        @media (max-height: 768px) {
          .map-legend {
            max-height: calc(100vh - 300px);
          }
        }

        @media (max-width: 768px) {
          .map-viewer {
            flex-direction: column;
          }

          .sidebar {
            width: 100%;
            max-height: 200px;
          }

          .map-container {
            height: calc(100% - 200px);
          }

          .station-info-overlay {
            top: 10px;
            right: 10px;
            left: 10px;
            max-width: none;
          }
        }
      `}</style>
    </div>
  );
};

export default MapViewer;