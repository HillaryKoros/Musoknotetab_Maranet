import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner, Table } from 'react-bootstrap';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  ComposedChart, Area
} from 'recharts';

const FloodAnalysis = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading state for the purpose of the example
    setTimeout(() => {
      setLoading(false);
    }, 2000);
  }, []);

  return (
    <Container className="text-center py-5">
      <Alert variant="info">
        This feature is still under development..
      </Alert>
    </Container>
  );
};

export default FloodAnalysis;