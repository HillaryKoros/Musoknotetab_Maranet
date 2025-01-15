import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner, Table } from 'react-bootstrap';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  ComposedChart, Area
} from 'recharts';

const FloodAnalysis = () => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analysisMode, setAnalysisMode] = useState('temporal');
  const [selectedMetric, setSelectedMetric] = useState('waterLevel');
  const [timeRange, setTimeRange] = useState('24h');
  const [selectedSector, setSelectedSector] = useState('admin1');

  // Administrative sectors
  const sectors = {
    admin1: ['Sector A', 'Sector B', 'Sector C', 'Sector D'],
    admin2: ['Region 1', 'Region 2', 'Region 3', 'Region 4', 'Region 5'],
    admin3: ['District 1', 'District 2', 'District 3']
  };

  const endpoints = {
    waterLevel: '/api/flood/water-levels',
    rainfall: '/api/flood/rainfall',
    flowRate: '/api/flood/flow-rates',
    floodExtent: '/api/flood/extent',
    riskZones: '/api/flood/risk-zones',
    evacuationRoutes: '/api/flood/evacuation-routes',
    damageAssessment: '/api/flood/damage-assessment'
  };

  const metricLabels = {
    waterLevel: 'Water Level (m)',
    rainfall: 'Rainfall (mm)',
    flowRate: 'Flow Rate (m³/s)',
    floodExtent: 'Flood Extent (km²)',
    riskZones: 'Risk Zones',
    evacuationRoutes: 'Evacuation Routes',
    damageAssessment: 'Damage Assessment'
  };

  const generateMockData = (metric, timeRange, sector) => {
    const dataPoints = timeRange === '24h' ? 24 : timeRange === '7d' ? 7 : 30;
    return sectors[sector].map(area => ({
      name: area,
      data: Array.from({ length: dataPoints }, (_, i) => ({
        timestamp: timeRange === '24h' ? `${i}:00` : `Day ${i + 1}`,
        value: Math.random() * 100,
        alert: Math.random() > 0.8 ? 'high' : Math.random() > 0.6 ? 'medium' : 'low'
      }))
    }));
  };

  const fetchData = async () => {
    try {
      const mockResults = Object.keys(endpoints).reduce((acc, key) => {
        acc[key] = generateMockData(key, timeRange, selectedSector);
        return acc;
      }, {});
      
      setData(mockResults);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch flood analysis data');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange, selectedSector]);

  const renderAnalysisChart = () => {
    if (loading) return <div className="text-center p-4"><Spinner animation="border" /></div>;
    if (error) return <Alert variant="danger">{error}</Alert>;

    const sectorData = data[selectedMetric] || [];
    const processedData = analysisMode === 'temporal' 
      ? sectorData[0]?.data || []
      : sectorData.map(sector => ({
          name: sector.name,
          value: sector.data.reduce((sum, d) => sum + d.value, 0) / sector.data.length
        }));

    switch (analysisMode) {
      case 'temporal':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
              <Legend />
              {sectorData.map((sector, index) => (
                <Line
                  key={sector.name}
                  data={sector.data}
                  type="monotone"
                  dataKey="value"
                  name={sector.name}
                  stroke={`hsl(${index * (360 / sectorData.length)}, 70%, 50%)`}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'comparative':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={processedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="value"
                fill="#2563eb"
                name={metricLabels[selectedMetric]}
              />
            </BarChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <Container fluid className="p-4">
      <Row className="mb-4">
        <Col md={3}>
          <Form.Group>
            <Form.Label>Administrative Level</Form.Label>
            <Form.Select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
            >
              <option value="admin1">Admin Level 1</option>
              <option value="admin2">Admin Level 2</option>
              <option value="admin3">Admin Level 3</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={3}>
          <Form.Group>
            <Form.Label>Analysis Mode</Form.Label>
            <Form.Select
              value={analysisMode}
              onChange={(e) => setAnalysisMode(e.target.value)}
            >
              <option value="temporal">Temporal Analysis</option>
              <option value="comparative">Comparative Analysis</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={3}>
          <Form.Group>
            <Form.Label>Metric</Form.Label>
            <Form.Select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
            >
              {Object.entries(metricLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={3}>
          <Form.Group>
            <Form.Label>Time Range</Form.Label>
            <Form.Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>

      <Card className="mb-4">
        <Card.Body>
          <Card.Title className="mb-4">
            {analysisMode === 'temporal' ? 'Temporal Analysis' : 'Comparative Analysis'}
          </Card.Title>
          {renderAnalysisChart()}
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <Card.Title className="mb-4">Alert Summary</Card.Title>
          <Row>
            {data[selectedMetric]?.map((sector) => {
              const alerts = sector.data.filter(d => d.alert === 'high').length;
              return (
                <Col key={sector.name} md={4} className="mb-3">
                  <div className="p-3 bg-light rounded">
                    <h5 className="mb-2">{sector.name}</h5>
                    <p className="mb-0">
                      <span className="text-danger fw-bold">{alerts}</span>
                      <span className="text-secondary"> high-risk alerts</span>
                    </p>
                  </div>
                </Col>
              );
            })}
          </Row>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default FloodAnalysis;