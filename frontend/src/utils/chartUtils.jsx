import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend as RechartsLegend, ResponsiveContainer } from 'recharts';

// Component to render a discharge forecast chart
export const DischargeChart = ({ timeSeriesData }) => {
  if (!timeSeriesData || timeSeriesData.length === 0) return <div className="chart-no-data">No data available.</div>;

  const processedData = timeSeriesData.map(item => ({
    time: new Date(item.time),
    gfs: Number(item.gfs),
    icon: Number(item.icon),
  })).filter(item => !isNaN(item.gfs) && !isNaN(item.icon));

  return (
    <div className="chart-container">
      <ResponsiveContainer>
        <LineChart data={processedData} margin={{ top: 20, right: 30, left: 70, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" angle={-45} textAnchor="end" height={100} tickFormatter={(dt) => dt.toLocaleDateString('en-GB')} minTickGap={50} />
          <YAxis 
            label={{ 
              value: 'Discharge (m³/s)', 
              angle: -90, 
              position: 'insideLeft', 
              offset: -10, 
              dy: 60, // Move the label downward to align with the x-axis
              style: { fontSize: '12px', fontWeight: 'bold' } 
            }} 
          />
          <Tooltip labelFormatter={(label) => `Date: ${label.toLocaleDateString('en-GB')}`} formatter={(value, name) => [Number(value).toFixed(1), name]} />
          <RechartsLegend />
          <Line type="monotone" dataKey="gfs" stroke="#1f77b4" name="GFS Forecast" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="icon" stroke="#ff7f0e" name="ICON Forecast" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Component to render GeoSFM charts (river depth or streamflow)
export const GeoSFMChart = ({ timeSeriesData, dataType = 'riverdepth' }) => {
  if (!timeSeriesData || timeSeriesData.length === 0) return <div className="chart-no-data">No data available.</div>;

  const yAxisLabel = dataType === 'riverdepth' ? 'River Depth (m)' : 'Streamflow (m³/s)';
  const tooltipLabel = dataType === 'riverdepth' ? 'River Depth' : 'Streamflow';
  const displayUnit = dataType === 'riverdepth' ? 'm' : 'm³/s';

  return (
    <div className="chart-container">
      <ResponsiveContainer>
        <LineChart data={timeSeriesData} margin={{ top: 20, right: 30, left: 70, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" angle={-45} textAnchor="end" height={100} tickFormatter={(dt) => new Date(dt).toLocaleDateString('en-GB')} minTickGap={50} />
          <YAxis 
            label={{ 
              value: yAxisLabel, 
              angle: -90, 
              position: 'insideLeft', 
              offset: -30, 
              dy: 60, // Move the label downward to align with the x-axis
              style: { fontSize: '12px', fontWeight: 'bold' } 
            }} 
            tickFormatter={(value) => Number(value).toFixed(2)} 
          />
          <Tooltip labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString('en-GB')}`} formatter={(value) => [`${Number(value).toFixed(2)} ${displayUnit}`, tooltipLabel]} />
          <RechartsLegend />
          <Line type="monotone" dataKey={dataType === 'riverdepth' ? 'depth' : 'streamflow'} stroke="#1f77b4" name={tooltipLabel} dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};