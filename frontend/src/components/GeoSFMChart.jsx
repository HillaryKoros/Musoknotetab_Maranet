import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend as RechartsLegend, ResponsiveContainer } from 'recharts';

/**
 * GeoSFMChart component for displaying GeoSFM time series data
 * 
 * @param {Object} props
 * @param {Array} props.timeSeriesData - Array of time series data points
 * @param {string} props.dataType - Type of data ('riverdepth' or 'streamflow')
 * @param {string} props.title - Chart title
 * @param {function} props.onToggleDataType - Function to toggle data type
 * @param {function} props.onClose - Function to close the chart
 */
const GeoSFMChart = ({ 
  timeSeriesData, 
  dataType = 'riverdepth', 
  title = 'GeoSFM Point',
  onToggleDataType,
  onClose
}) => {
  if (!timeSeriesData || timeSeriesData.length === 0) {
    return (
      <div className="bottom-panel">
        <div className="chart-header">
          <h5>{title} - {dataType === 'riverdepth' ? 'River Depth' : 'Streamflow'}</h5>
          <div className="chart-controls">
            <button className="data-type-toggle" onClick={onToggleDataType}>
              {dataType === 'riverdepth' ? 'Show Streamflow' : 'Show River Depth'}
            </button>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="chart-no-data">No data available for the selected GeoSFM point.</div>
      </div>
    );
  }

  const yAxisLabel = dataType === 'riverdepth' ? 'River Depth (m)' : 'Streamflow (m³/s)';
  const tooltipLabel = dataType === 'riverdepth' ? 'River Depth' : 'Streamflow';
  const displayUnit = dataType === 'riverdepth' ? 'm' : 'm³/s';

  return (
    <div className="bottom-panel">
      <div className="chart-header">
        <h5>{title} - {dataType === 'riverdepth' ? 'River Depth' : 'Streamflow'}</h5>
        <div className="chart-controls">
          <button className="data-type-toggle" onClick={onToggleDataType}>
            {dataType === 'riverdepth' ? 'Show Streamflow' : 'Show River Depth'}
          </button>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
      </div>
      
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={timeSeriesData}
            margin={{ top: 20, right: 30, left: 70, bottom: 80 }}
            syncId="geosfm-chart"
          >
            <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} />
            <XAxis
              dataKey="time"
              angle={-45}
              textAnchor="end"
              height={100}
              interval="preserveStartEnd"
              tick={{ fontSize: 12 }}
              tickFormatter={(dt) => new Date(dt).toLocaleDateString('en-GB')}
              minTickGap={50}
              tickSize={8}
              axisLine={true}
              tickLine={true}
            />
            <YAxis
              domain={['auto', 'auto']}
              tickCount={5}
              tickFormatter={(value) => Number(value).toFixed(2)}
              label={{
                value: yAxisLabel,
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
              labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString('en-GB')}`}
              formatter={(value) => [`${Number(value).toFixed(2)} ${displayUnit}`, tooltipLabel]}
            />
            <RechartsLegend />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#1f77b4"
              name={tooltipLabel}
              dot={true}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default GeoSFMChart;