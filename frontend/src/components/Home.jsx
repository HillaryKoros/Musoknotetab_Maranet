import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, ReferenceLine
} from 'recharts';

const Home = () => {
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [loading, setLoading] = useState(true);

  const features = [
    { title: 'Interactive Map Viewer', description: 'Explore flood related data layers with interactive map interface', link: '/map', icon: '🗺️' },
    { title: 'Data Reports', description: 'View reports and statistics for different layers', link: '/reports', icon: '📊' },
    { title: 'Advanced Analysis', description: 'Perform analysis of flood and demographic data', link: '/analysis', icon: '📈' },
  ];

  const regions = [
    { value: 'all', label: 'All Regions' },
    { value: 'eastern', label: 'Eastern Region' },
    { value: 'central', label: 'Central Region' },
    { value: 'western', label: 'Western Region' }
  ];

  useEffect(() => {
    const generateData = () => {
      const data = [];
      const startDate = new Date();
      
      for (let i = 0; i < 60; i++) {
        const currentDate = new Date(startDate);
        currentDate.setHours(currentDate.getHours() + (i * 2));
        
        const timeOfDay = (i % 12) / 12;
        const dayEffect = Math.sin(i / 30 * Math.PI) * 10;
        
        const gfsValue = 60 + 
                        Math.sin(timeOfDay * 2 * Math.PI) * 10 + 
                        dayEffect;
        
        const iconValue = gfsValue + 30 + Math.sin(timeOfDay * 2 * Math.PI) * 5;
        
        data.push({
          time: currentDate.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric'
          }),
          discharge_simulated_gfs: gfsValue,
          discharge_simulated_icon: iconValue,
          threshold: 100
        });
      }
      return data;
    };

    setTimeSeriesData(generateData());
    setLoading(false);
  }, [selectedRegion]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border rounded shadow-sm">
          <p className="mb-1"><strong>{label}</strong></p>
          {payload.map((item, index) => (
            <p key={index} className="mb-0" style={{ color: item.color }}>
              {item.name}: {item.value.toFixed(1)} m³/s
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Get today's date in the correct format to match the time series
  const getTodayIndex = () => {
    const today = new Date();
    return timeSeriesData.findIndex(
      (data) => data.time === today.toLocaleString('en-US', { month: 'short', day: 'numeric' })
    );
  };

  const todayIndex = getTodayIndex(); // Position of today's date in the time series data

  return (
    <Container className="py-4">
      <Row className="mb-3">
        <Col>
          <h2 className="text-center mb-2">EAFW</h2>
          <p className="text-center">
            Explore, analyze, and visualize flood related data for East Africa
          </p>
        </Col>
      </Row>
      
      <Row className="mb-4">
        <Col>
          <Card>
            <Card.Body>
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Region</Form.Label>
                    <Form.Select
                      value={selectedRegion}
                      onChange={(e) => setSelectedRegion(e.target.value)}
                      size="sm"
                    >
                      {regions.map(region => (
                        <option key={region.value} value={region.value}>
                          {region.label}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6} className="d-flex align-items-end">
                  <Button variant="outline-primary" size="sm" className="w-100">
                    Update View
                  </Button>
                </Col>
              </Row>
              <div style={{ height: '300px' }}>
                {!loading && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={timeSeriesData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="time" 
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" height={36} />
                      <Area
                        type="monotone"
                        dataKey="discharge_simulated_icon"
                        data={timeSeriesData}
                        fill="#8884d8"
                        stroke="none"
                        fillOpacity={0.2}
                      />
                      <Area
                        type="monotone"
                        dataKey="discharge_simulated_gfs"
                        data={timeSeriesData}
                        fill="#8884d8"
                        stroke="none"
                        fillOpacity={0.2}
                      />
                      <Line
                        type="monotone"
                        dataKey="discharge_simulated_gfs"
                        stroke="#0d6efd"
                        name="GFS Discharge (m³/s)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="discharge_simulated_icon"
                        stroke="#198754"
                        name="ICON Discharge (m³/s)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="threshold"
                        stroke="#dc3545"
                        strokeDasharray="5 5"
                        name="Alert Threshold"
                        dot={false}
                      />
                      {todayIndex !== -1 && (
                        <ReferenceLine
                          x={timeSeriesData[todayIndex].time}
                          stroke="#dc3545"
                          strokeDasharray="5 5"
                          label="Today"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        {features.map((feature, index) => (
          <Col key={index} md={4} className="mb-3">
            <Card className="h-100">
              <Card.Body className="text-center p-3">
                <div className="h4 mb-2">{feature.icon}</div>
                <Card.Title className="h5">{feature.title}</Card.Title>
                <Card.Text className="small">{feature.description}</Card.Text>
                <Button as={Link} to={feature.link} variant="primary" size="sm">
                  Explore
                </Button>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </Container>
  );
};

export default Home;
