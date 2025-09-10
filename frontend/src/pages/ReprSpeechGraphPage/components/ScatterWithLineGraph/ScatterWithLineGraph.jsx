import React from 'react';
import PropTypes from 'prop-types';
import {
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { Party2Party, Party2Color } from 'resource/resources';
import useDisplaySize from 'state/useDisplayType';
import { getXAxis, getYAxis } from './utils';
import GraphLegendContent from './Legend';
import TooltipContent from './Tooltip';

function ScatterWithLineGraph({
  displayLine,
  scatterData,
  lineData,
  setCurrentRepr,
  setCurrentParty,
  setCurrentHouse,
  showXAxis,
  showYAxis,
  currentRepr,
}) {
  // Calculate min and max values for X and Y axes in a single pass
  const { xMin, xMax, yMin, yMax } = React.useMemo(() => {
	// eslint-disable-next-line one-var
    let minX = Infinity, maxX = -Infinity;
	// eslint-disable-next-line one-var
    let minY = Infinity, maxY = -Infinity;
    
    scatterData.forEach(d => {
      const x = Number(d.x);
      const y = Number(d.y);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    
    return { xMin: minX, xMax: maxX, yMin: minY, yMax: maxY };
  }, [scatterData]);

  const { type: DisplayType } = useDisplaySize();
  const isMobile = DisplayType === 'mobile';
  const pointSize = isMobile ? 5 : 20;

  const [tooltipData, setTooltipData] = React.useState(null);

  const handlePointClick = (e) => {
    if (!e) {
      return;
    }
    const { activePayload } = e;

    if (activePayload?.length === 0) {
      return;
    }
    const { payload } = activePayload[0];
    setCurrentRepr(payload.repr);
    setCurrentParty(Party2Party[payload.party]);
    setCurrentHouse(payload.house);
  };

  // Custom function to find nearest point by Euclidean distance
  const findNearestPoint = React.useCallback((mouseX, mouseY) => {
    if (!scatterData || scatterData.length === 0) return null;

    let minDistanceSquared = Infinity;
    let nearestPoint = null;

    // Use squared distance to avoid expensive sqrt calculation
    for (let i = 0; i < scatterData.length; i+=1) {
      const point = scatterData[i];
      const dx = mouseX - Number(point.x);
      const dy = mouseY - Number(point.y);
      const distanceSquared = dx * dx + dy * dy;

      if (distanceSquared < minDistanceSquared) {
        minDistanceSquared = distanceSquared;
        nearestPoint = point;
      }
    }

    return nearestPoint;
  }, [scatterData]);

  // Custom tooltip handler
  const handleMouseMove = React.useCallback((e) => {
    if (!e || !e.activeCoordinate) {
      setTooltipData(null);
      return;
    }

    const { x, y } = e.activeCoordinate;
    const nearestPoint = findNearestPoint(x, y);
    
    if (nearestPoint) {
      setTooltipData({
        active: true,
        payload: [{ payload: nearestPoint }],
        coordinate: e.activeCoordinate
      });
    }
  }, [findNearestPoint]);

  const handleMouseLeave = React.useCallback(() => {
    setTooltipData(null);
  }, []);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        width={400}
        height={250}
        margin={{
          top: 20,
          right: 40,
          bottom: 10,
          left: 10,
        }}
        onMouseDown={(e) => handlePointClick(e)}
        onClick={(e) => handlePointClick(e)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey={getXAxis}
          type="number"
          domain={[xMin, xMax]}
          axisLine={showXAxis}
          tick={showXAxis}
          tickLine={showXAxis}
        />
        <YAxis
          dataKey={getYAxis}
          type="number"
          domain={[yMin, yMax]}
          color="white"
          axisLine={showYAxis}
          tickLine={showYAxis}
          tick={showYAxis}
        />
        <ZAxis range={[pointSize, pointSize]} />
        <Tooltip
          content={tooltipData ? 
            <TooltipContent 
              active={tooltipData.active} 
              payload={tooltipData.payload} 
              label=""
              coordinate={tooltipData.coordinate}
            /> : 
            null
          }
          cursor={false}
        />
        <Legend content={<GraphLegendContent />} verticalAlign="top" />
        <Scatter data={scatterData} dataKey={getYAxis}>
          {scatterData.map((entry, index) => (
            <Cell
              // eslint-disable-next-line react/no-array-index-key
              key={`cell-${index}`}
              data={scatterData}
              fill={Party2Color[entry.party]|| entry.color}
              opacity={currentRepr === entry.repr ? 1 : 0.5}
              strokeWidth={currentRepr === entry.repr ? 20 : 1}
              stroke={Party2Color[entry.party]|| entry.color}
            />
          ))}
        </Scatter>
        <Line
          stroke="black"
          dot={false}
          data={displayLine ? lineData : []}
          strokeWidth={3}
          type="monotone"
          dataKey={getYAxis}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

ScatterWithLineGraph.defaultProps = {
  showXAxis: true,
  showYAxis: true,
  currentRepr: null,
};
ScatterWithLineGraph.propTypes = {
  scatterData: PropTypes.arrayOf(
    PropTypes.shape({
      x: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      y: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      z: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      color: PropTypes.string,
      party: PropTypes.string,
      name: PropTypes.string,
    })
  ).isRequired,
  lineData: PropTypes.arrayOf(
    PropTypes.shape({
      x: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      y: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      z: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      color: PropTypes.string,
      party: PropTypes.string,
      name: PropTypes.string,
    })
  ).isRequired,
  setCurrentRepr: PropTypes.func.isRequired,
  setCurrentParty: PropTypes.func.isRequired,
  setCurrentHouse: PropTypes.func.isRequired,
  displayLine: PropTypes.bool.isRequired,
  showXAxis: PropTypes.bool,
  showYAxis: PropTypes.bool,
  currentRepr: PropTypes.string,
};

export default ScatterWithLineGraph;
