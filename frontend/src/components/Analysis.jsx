import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner, Table } from 'react-bootstrap';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
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

  // Improved data fetching with error handling and retry logic
  const fetchDataWithRetry = async (url, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
  };

  const fetchAllData = async () => {
    try {
      const results = await Promise.all(
        Object.entries(endpoints).map(async ([key, url]) => {
          const data = await fetchDataWithRetry(url);
          return [key, data];
        })
      );
      setData(Object.fromEntries(results));
      setLoading(false);
    } catch (err) {
      setError(`Failed to fetch data: ${err.message}`);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Improved data processing with safety checks
  const processDataForAnalysis = (metricKey, timeRangeFilter = 'all') => {
    if (!data[metricKey]?.features) return [];

    let filteredData = data[metricKey].features
      .filter(feature => feature.properties && typeof feature.properties.flood_tot === 'number');

    if (timeRangeFilter !== 'all') {
      const cutoffDate = new Date();
      switch (timeRangeFilter) {
        case 'year':
          cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
          break;
        case 'month':
          cutoffDate.setMonth(cutoffDate.getMonth() - 1);
          break;
        case 'week':
          cutoffDate.setDate(cutoffDate.getDate() - 7);
          break;
      }
      filteredData = filteredData.filter(feature => 
        new Date(feature.properties.date) >= cutoffDate
      );
    }

    return filteredData;
  };

  const processDataForCorrelation = () => {
    const primaryData = processDataForAnalysis(selectedMetrics.primary, timeRange);
    const secondaryData = processDataForAnalysis(selectedMetrics.secondary, timeRange);

    return primaryData
      .map((feature, index) => {
        const secondaryFeature = secondaryData[index];
        if (!secondaryFeature) return null;

        return {
          name: feature.properties.name,
          x: feature.properties.flood_tot,
          y: secondaryFeature.properties.flood_tot,
          z: 20
        };
      })
      .filter(item => item && item.x > 0 && item.y > 0);
  };

  const calculateStatistics = (dataArray) => {
    if (!dataArray || dataArray.length === 0) return null;

    const values = dataArray
      .map(item => item.properties.flood_tot)
      .filter(val => typeof val === 'number' && !isNaN(val));

    if (values.length === 0) return null;

    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const sortedValues = [...values].sort((a, b) => a - b);
    const median = values.length % 2 === 0
      ? (sortedValues[values.length / 2 - 1] + sortedValues[values.length / 2]) / 2
      : sortedValues[Math.floor(values.length / 2)];
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;

    return {
      count: values.length,
      sum: sum.toFixed(2),
      mean: mean.toFixed(2),
      median: median.toFixed(2),
      stdDev: Math.sqrt(variance).toFixed(2),
      min: Math.min(...values).toFixed(2),
      max: Math.max(...values).toFixed(2)
    };
  };

  const renderAnalysisChart = () => {
    if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;
    if (error) return <div className="text-red-500 p-4">{error}</div>;

    switch (analysisType) {
      case 'correlation':
        return (
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
        );

      case 'trend':
        const trendData = processDataForAnalysis(selectedMetrics.primary, timeRange)
          .map((feature, index) => ({
            name: feature.properties.name,
            value: feature.properties.flood_tot,
            trend: index
          }))
          .filter(item => item.value > 0)
          .sort((a, b) => b.value - a.value);

        return (
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={trendData}>
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
        );

      case 'comparative':
        const comparativeData = processDataForAnalysis(selectedMetrics.primary, timeRange)
          .map(feature => ({
            name: feature.properties.name,
            value: feature.properties.flood_tot
          }))
          .filter(item => item.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);

        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={comparativeData}>
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
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-4">
      {/* <h2 className="text-2xl font-bold mb-4">Advanced Analysis Dashboard</h2> */}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Analysis Type</label>
          <select
            className="w-full p-2 border rounded"
            value={analysisType}
            onChange={(e) => setAnalysisType(e.target.value)}
          >
            <option value="correlation">Correlation Analysis</option>
            <option value="trend">Trend Analysis</option>
            <option value="comparative">Comparative Analysis</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Primary Metric</label>
          <select
            className="w-full p-2 border rounded"
            value={selectedMetrics.primary}
            onChange={(e) => setSelectedMetrics(prev => ({
              ...prev,
              primary: e.target.value
            }))}
          >
            {Object.entries(metricLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Secondary Metric</label>
          <select
            className="w-full p-2 border rounded"
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
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Time Range</label>
          <select
            className="w-full p-2 border rounded"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="all">All Time</option>
            <option value="year">Past Year</option>
            <option value="month">Past Month</option>
            <option value="week">Past Week</option>
          </select>
        </div>
      </div>

      <Card className="mb-4">
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">
            {analysisType === 'correlation' ? 'Correlation Analysis' :
             analysisType === 'trend' ? 'Trend Analysis' :
             'Comparative Analysis'}
          </h3>
          {renderAnalysisChart()}
        </div>
      </Card>

      <Card>
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">Statistical Summary</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metric</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sum</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mean</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Median</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Std Dev</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(metricLabels).map(([key, label]) => {
                  const stats = calculateStatistics(processDataForAnalysis(key, timeRange));
                  return stats ? (
                    <tr key={key}>
                      <td className="px-6 py-4 whitespace-nowrap">{label}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{stats.count}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{stats.sum}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{stats.mean}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{stats.median}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{stats.stdDev}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{stats.min}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{stats.max}</td>
                    </tr>
                  ) : null;
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Analysis;