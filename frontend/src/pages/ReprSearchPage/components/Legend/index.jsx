import React from 'react';
import { Party2ColorList } from 'resource/resources';
import { colors } from 'resource/styling';
import useDisplaySize from 'state/useDisplayType';

function MapLegend() {
  const { type } = useDisplaySize();
  if (type === 'mobile') {
    return null;
  }
  return (
    <div
      className={`flex flex-wrap justify-center items-center h-full ml-2 w-full z-40 rounded-lg ${colors.primary}`}
    >
      {Party2ColorList.map((d) => (
        <div className="flex px-2" key={d.party}>
          <h1>{d.party}</h1>
          <div
            className="w-5 h-5 rounded-full ml-2"
            style={{ backgroundColor: d.color }}
          />
        </div>
      ))}
    </div>
  );
}

export default MapLegend;
