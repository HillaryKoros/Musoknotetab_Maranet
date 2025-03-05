import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend as RechartsLegend, ResponsiveContainer } from 'recharts';

/**
 * DischargeChart component for displaying station discharge forecasts
 * 
 * @param {Object} props
 * @param {Array} props.timeSeriesData - Array of time series data points
 * @param {string} props.title - Chart title
 * @param {function} props.onClose - Function to close the chart
 */
const DischargeChart = ({ 
  timeSeriesData, 
  title = 'Discharge Forecast',
  onClose
}) => {
  if (!timeSeriesData || timeSeriesData.length === 0) {
    return (
      <div className="bottom-panel">
        <div className="chart-header">
          <h5>{title}</h5>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="chart-no-data">No data available for the selected station.</div>
      </div>
    );
  }

  const processedData = timeSeriesData.map(item => ({
    time: new Date(item.time),
    gfs: Number(item.gfs),
    icon: Number(item.icon)
  })).filter(item => !isNaN(item.gfs) && !isNaN(item.icon));

  return (
    <div className="bottom-panel">
      <div className="chart-header">
        <h5>{title}</h5>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={processedData}
            margin={{ top: 20, right: 30, left: 70, bottom: 80 }}
            syncId="station-chart"
          >
            <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} />
            <XAxis
              dataKey="time"
              angle={-45}
              textAnchor="end"
              height={100}
              interval="preserveStartEnd"
              tick={{ fontSize: 12 }}
              tickFormatter={(dt) =>
                dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
              }
              minTickGap={50}
              tickSize={8}
              axisLine={true}
              tickLine={true}
            />
            <YAxis
              domain={['auto', 'auto']}
              tickCount={5}
              tickFormatter={(value) => Number(value).toFixed(1)}
              label={{
                value: 'Discharge (m³/s)',
                angle: -90,
                position: 'insideLeft',
                offset: -50,
                style: {
                  textAnchor: 'middle',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }
              }}
              padding={{ left: 20 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid #ddd'
              }}
              labelFormatter={(label) => `Date: ${label.toLocaleDateString('en-GB')}`}
              formatter={(value, name) => [`${Number(value).toFixed(1)}`, `${name}`]}
            />
            <RechartsLegend />
            <Line
              type="monotone"
              dataKey="gfs"
              stroke="#1f77b4"
              name="GFS Forecast"
              dot={false}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="icon"
              stroke="#ff7f0e"
              name="ICON Forecast"
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DischargeChart;