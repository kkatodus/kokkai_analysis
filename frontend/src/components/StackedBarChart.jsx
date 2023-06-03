import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  LabelList} from 'recharts';
import React from 'react';

/**
 * @param {object} props
 * @return {JSX.Element}
*/
function StackedBarChart(props) {
  const {data, width, height} = props;
  return (
    <ResponsiveContainer height={height} width={width}>
      <BarChart
        layout='vertical'
        data={data}
        stackOffset="expand"
      >
        <XAxis hide type="number"/>
        <YAxis
          hide
          type="category"
          dataKey="name"
          stroke="#FFFFF"
          fontSize={12}
        />
        <Tooltip/>
        <Bar dataKey="反対" fill="#dd7876" stackId="a">
          <LabelList
            dataKey="反対"
            position="center"
          />
        </Bar>
        <Bar dataKey="賛成" fill="#82ba7f" stackId="a">
          <LabelList
            dataKey="賛成"
            position="center"
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>

  );
}
StackedBarChart.propTypes = {
  data: Object,
  width: String,
  height: Number,
};

export default StackedBarChart;
