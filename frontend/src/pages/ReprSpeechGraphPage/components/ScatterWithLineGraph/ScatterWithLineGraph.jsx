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
import { Party2Party } from 'resource/resources';
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
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey={getXAxis}
          type="number"
          domain={['auto', 'auto']}
          axisLine={showXAxis}
          tick={showXAxis}
          tickLine={showXAxis}
        />
        <YAxis
          dataKey={getYAxis}
          type="number"
          domain={['auto', 'auto']}
          color="white"
          axisLine={showYAxis}
          tickLine={showYAxis}
          tick={showYAxis}
        />
		<ZAxis range={[20,20]} />
        <Tooltip
          content={<TooltipContent active={false} payload={[]} label="" />}
        />
        <Legend content={<GraphLegendContent />} verticalAlign="top" />
        <Scatter data={scatterData} dataKey={getYAxis}>
          {scatterData.map((entry, index) => 
            <Cell
              // eslint-disable-next-line react/no-array-index-key
              key={`cell-${index}`}
              data={scatterData}
              fill={entry.color}
              opacity={currentRepr === entry.repr ? 1 : 0.5}
			  strokeWidth={currentRepr === entry.repr ? 20 : 1}
			  stroke={entry.color}
            />
          )}
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
