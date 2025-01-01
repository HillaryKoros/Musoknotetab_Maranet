import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner, Table } from 'react-bootstrap';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ZAxis, LineChart, Line, BarChart, Bar,
  ComposedChart, Area
} from 'recharts';

const Analysis = () => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMetrics, setSelectedMetrics] = useState({
    primary: 'affectedPop',
    secondary: 'affectedGDP'
  });
  const [timeRange, setTimeRange] = useState('all');
  const [analysisType, setAnalysisType] = useState('correlation');

  const endpoints = {
    affectedPop: 'http://127.0.0.1:8000/api/affectedPop/',
    affectedGDP: 'http://127.0.0.1:8000/api/affectedGDP/',
    affectedCrops: 'http://127.0.0.1:8000/api/affectedCrops/',
    affectedRoads: 'http://127.0.0.1:8000/api/affectedRoads/',
    displacedPop: 'http://127.0.0.1:8000/api/displacedPop/',
    affectedLivestock: 'http://127.0.0.1:8000/api/affectedLivestock/',
    affectedGrazingLand: 'http://127.0.0.1:8000/api/affectedGrazingLand/',
  };

  const metricLabels = {
    affectedPop: 'Affected Population',
    affectedGDP: 'GDP Impact',
    affectedCrops: 'Affected Crops',
    affectedRoads: 'Affected Roads',
    displacedPop: 'Displaced Population',
    affectedLivestock: 'Affected Livestock',
    affectedGrazingLand: 'Affected Grazing Land'
  };

  const fetchAllData = async () => {
    try {
      const results = await Promise.all(
        Object.entries(endpoints).map(async ([key, url]) => {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const data = await response.json();
          return [key, data];
        })
      );

      const processedData = Object.fromEntries(results);
      setData(processedData);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch data: ' + err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const processDataForCorrelation = () => {
    if (!data[selectedMetrics.primary] || !data[selectedMetrics.secondary]) return [];

    return data[selectedMetrics.primary].features.map((feature, index) => ({
      name: feature.properties.name,
      x: feature.properties.flood_tot || 0,
      y: (data[selectedMetrics.secondary].features[index]?.properties.flood_tot || 0),
      z: 20, // Size of scatter points
    })).filter(item => item.x > 0 && item.y > 0);
  };

  const calculateStatistics = (dataArray) => {
    if (!dataArray || dataArray.length === 0) return null;

    const values = dataArray.map(item => item.properties.flood_tot).filter(val => val > 0);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const sortedValues = [...values].sort((a, b) => a - b);
    const median = sortedValues[Math.floor(values.length / 2)];
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      count: values.length,
      sum: sum.toFixed(2),
      mean: mean.toFixed(2),
      median: median.toFixed(2),
      stdDev: stdDev.toFixed(2),
      min: Math.min(...values).toFixed(2),
      max: Math.max(...values).toFixed(2)
    };
  };

  const calculateTrends = (metricKey) => {
    if (!data[metricKey]) return [];

    return data[metricKey].features
      .map((feature, index) => ({
        name: feature.properties.name,
        value: feature.properties.flood_tot || 0,
        trend: index
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  };

  const renderCorrelationAnalysis = () => (
    <Card className="mb-4">
      <Card.Body>
        <Card.Title>Correlation Analysis</Card.Title>
        <Row>
          <Col md={8}>
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid />
                <XAxis 
                  dataKey="x" 
                  name={metricLabels[selectedMetrics.primary]}
                  type="number"
                />
                <YAxis 
                  dataKey="y" 
                  name={metricLabels[selectedMetrics.secondary]}
                  type="number"
                />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Legend />
                <Scatter
                  name="Correlation"
                  data={processDataForCorrelation()}
                  fill="#8884d8"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </Col>
          <Col md={4}>
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(calculateStatistics(data[selectedMetrics.primary]?.features || [])).map(([key, value]) => (
                  <tr key={key}>
                    <td>{key}</td>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );

  const renderTrendAnalysis = () => (
    <Card className="mb-4">
      <Card.Body>
        <Card.Title>Trend Analysis</Card.Title>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={calculateTrends(selectedMetrics.primary)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="value" 
              fill="#8884d8" 
              stroke="#8884d8"
              name={metricLabels[selectedMetrics.primary]}
            />
            <Line 
              type="monotone" 
              dataKey="trend" 
              stroke="#ff7300" 
              name="Trend"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Card.Body>
    </Card>
  );

  const renderComparativeAnalysis = () => (
    <Card className="mb-4">
      <Card.Body>
        <Card.Title>Comparative Analysis</Card.Title>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={calculateTrends(selectedMetrics.primary).slice(0, 10)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar 
              dataKey="value" 
              fill="#8884d8" 
              name={metricLabels[selectedMetrics.primary]}
            />
          </BarChart>
        </ResponsiveContainer>
      </Card.Body>
    </Card>
  );

  if (loading) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" />
        <p>Loading analysis data...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4">
      <h2 className="mb-4">Advanced Analysis Dashboard</h2>

      <Row className="mb-4">
        <Col md={3}>
          <Form.Group>
            <Form.Label>Analysis Type</Form.Label>
            <Form.Select
              value={analysisType}
              onChange={(e) => setAnalysisType(e.target.value)}
            >
              <option value="correlation">Correlation Analysis</option>
              <option value="trend">Trend Analysis</option>
              <option value="comparative">Comparative Analysis</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={3}>
          <Form.Group>
            <Form.Label>Primary Metric</Form.Label>
            <Form.Select
              value={selectedMetrics.primary}
              onChange={(e) => setSelectedMetrics(prev => ({
                ...prev,
                primary: e.target.value
              }))}
            >
              {Object.entries(metricLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={3}>
          <Form.Group>
            <Form.Label>Secondary Metric</Form.Label>
            <Form.Select
              value={selectedMetrics.secondary}
              onChange={(e) => setSelectedMetrics(prev => ({
                ...prev,
                secondary: e.target.value
              }))}
              disabled={analysisType !== 'correlation'}
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
              <option value="all">All Time</option>
              <option value="year">Past Year</option>
              <option value="month">Past Month</option>
              <option value="week">Past Week</option>
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>

      {analysisType === 'correlation' && renderCorrelationAnalysis()}
      {analysisType === 'trend' && renderTrendAnalysis()}
      {analysisType === 'comparative' && renderComparativeAnalysis()}

      <Row>
        <Col md={12}>
          <Card>
            <Card.Body>
              <Card.Title>Statistical Summary</Card.Title>
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Count</th>
                    <th>Sum</th>
                    <th>Mean</th>
                    <th>Median</th>
                    <th>Std Dev</th>
                    <th>Min</th>
                    <th>Max</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(metricLabels).map(([key, label]) => {
                    const stats = calculateStatistics(data[key]?.features);
                    return stats ? (
                      <tr key={key}>
                        <td>{label}</td>
                        <td>{stats.count}</td>
                        <td>{stats.sum}</td>
                        <td>{stats.mean}</td>
                        <td>{stats.median}</td>
                        <td>{stats.stdDev}</td>
                        <td>{stats.min}</td>
                        <td>{stats.max}</td>
                      </tr>
                    ) : null;
                  })}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Analysis;