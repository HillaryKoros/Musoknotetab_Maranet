import React from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const Home = () => {
  const features = [
    {
      title: 'Interactive Map Viewer',
      description: 'Explore flood related  data layers with interactive map interface',
      link: '/map',
      icon: '🗺️'
    },
    {
      title: 'Data Reports',
      description: 'View reports and statistics for different layers',
      link: '/reports',
      icon: '📊'
    },
    {
      title: 'Advanced Analysis',
      description: 'Perform analysis of flood and demographic data',
      link: '/analysis',
      icon: '📈'
    }
  ];

  return (
    <Container className="py-5">
      <Row className="mb-5">
        <Col>
          <h1 className="text-center mb-4">East Africa Flood Watch</h1>
          <p className="text-center lead">
            Explore, analyze, and visualize flood related data and impact based forecasted outputs for East Africa
          </p>
        </Col>
      </Row>

      <Row>
        {features.map((feature, index) => (
          <Col key={index} md={4} className="mb-4">
            <Card className="h-100">
              <Card.Body className="text-center">
                <div className="display-4 mb-3">{feature.icon}</div>
                <Card.Title>{feature.title}</Card.Title>
                <Card.Text>{feature.description}</Card.Text>
                <Button as={Link} to={feature.link} variant="primary">
                  Explore
                </Button>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Row className="mt-5">
        <Col md={8} className="mx-auto">
          <Card className="bg-light">
            <Card.Body>
              <h3>Quick Start Guide</h3>
              <ul className="list-unstyled">
                <li>✓ Select Map Viewer to explore geographic layers</li>
                <li>✓ View Reports for data visualization and statistics</li>
                <li>✓ Use Analysis tools for advanced data exploration</li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Home;