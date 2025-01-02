import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Spinner, Alert, Tab, Tabs } from 'react-bootstrap';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';

const Reports = () => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  const endpoints = {
    affectedPop: 'http://127.0.0.1:8000/api/affectedPop/',
    affectedGDP: 'http://127.0.0.1:8000/api/affectedGDP/',
    affectedCrops: 'http://127.0.0.1:8000/api/affectedCrops/',
    affectedRoads: 'http://127.0.0.1:8000/api/affectedRoads/',
    displacedPop: 'http://127.0.0.1:8000/api/displacedPop/',
    affectedLivestock: 'http://127.0.0.1:8000/api/affectedLivestock/',
    affectedGrazingLand: 'http://127.0.0.1:8000/api/affectedGrazingLand/',
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

  const processDataForCharts = (data) => {
    if (!data || !data.features) return [];
    return data.features
      .map(feature => ({
        name: feature.properties.name_1 || 'Unknown',
        value: feature.properties.flood_tot || 0
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 values
  };

  const calculateSummaryStats = (data) => {
    if (!data || !data.features) return { total: 0, average: 0, max: 0 };
    const values = data.features.map(f => f.properties.flood_tot || 0);
    return {
      total: values.reduce((a, b) => a + b, 0),
      average: values.reduce((a, b) => a + b, 0) / values.length,
      max: Math.max(...values)
    };
  };

  if (loading) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" />
        <p>Loading report data...</p>
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
      <h2 className="mb-4">Impact Assessment Reports</h2>
      
      <Tabs defaultActiveKey="population" className="mb-4">
        <Tab eventKey="population" title="Population Impact">
          <Row className="mb-4">
            <Col md={6}>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>Affected Population Distribution</Card.Title>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={processDataForCharts(data.affectedPop)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" fill="#8884d8" name="Affected Population" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>Displaced Population Overview</Card.Title>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={processDataForCharts(data.displacedPop)}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label
                      >
                        {processDataForCharts(data.displacedPop).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Tab>

        <Tab eventKey="economic" title="Economic Impact">
          <Row className="mb-4">
            <Col md={8}>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>GDP Impact Trend</Card.Title>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={processDataForCharts(data.affectedGDP)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="value" stroke="#8884d8" name="GDP Impact" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>Economic Summary</Card.Title>
                  <div className="p-3">
                    {Object.entries(calculateSummaryStats(data.affectedGDP)).map(([key, value]) => (
                      <div key={key} className="mb-3">
                        <h6 className="text-muted text-capitalize">{key}</h6>
                        <h4>{value.toLocaleString()}</h4>
                      </div>
                    ))}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Tab>

        <Tab eventKey="agriculture" title="Agricultural Impact">
          <Row className="mb-4">
            <Col md={6}>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>Affected Crops Analysis</Card.Title>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={processDataForCharts(data.affectedCrops)}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="name" />
                      <PolarRadiusAxis />
                      <Radar name="Impact" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                    </RadarChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>Grazing Land Impact</Card.Title>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={processDataForCharts(data.affectedGrazingLand)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" fill="#82ca9d" name="Affected Area" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Tab>
      </Tabs>
    </Container>
  );
};

export default Reports;