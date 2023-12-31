import React from 'react';
import { Party2ColorList } from '../../../../resource/resources';

function RenderLegend() {
  return (
    <div className="flex flex-wrap">
      {Party2ColorList.map((d) => (
        <div className="flex px-2">
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

export default RenderLegend;
