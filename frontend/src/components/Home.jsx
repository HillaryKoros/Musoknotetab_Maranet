import React from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const Home = () => {
  const features = [
    { title: 'Interactive Map Viewer', description: 'Explore flood related data layers with interactive map interface', link: '/map', icon: '🗺️' },
    { title: 'Data Reports', description: 'View reports and statistics for different layers', link: '/reports', icon: '📊' },
    { title: 'Advanced Analysis', description: 'Perform analysis of flood and demographic data', link: '/analysis', icon: '📈' },
  ];

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
