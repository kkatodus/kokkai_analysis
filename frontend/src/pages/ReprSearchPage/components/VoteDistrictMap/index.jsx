import React from 'react';
import { GeoJsonLayer } from '@deck.gl/layers';
import DeckGL from '@deck.gl/react';
import Proptypes from 'prop-types';
import { Party2RGBColor } from 'resource/resources';
import { Map } from 'react-map-gl';
import useLowerKu2Party from 'state/useLowerKu2Party';

// eslint-disable-next-line no-unused-vars
const { REACT_APP_MAPBOX_ACCESS_TOKEN } = process.env;

const INITIAL_VIEW_STATE = {
  longitude: 136.4354,
  latitude: 35.166212,
  zoom: 6,
  pitch: 60,
  bearing: -20,
};

const MAP_STYLE = 'mapbox://styles/kkatodus/clnkx6x1z002601p7c4vl398t';

function VoteDistrictMap({
  setCurrentDistrict,
  geoJsonData,
  selectedDistrict,
}) {
  // Geojson data for voting districts
  const [Ku2Party] = useLowerKu2Party();

  const getToolTip = ({ object }) => {
    if (object) {
      const { kuname } = object.properties;

      return { html: `<h1>${kuname}</h1>` };
    }
    return null;
  };
  const getFillColor = (f) => {
    let { kuname } = f.properties;
    kuname = kuname.replace('区', '');
    if (kuname === selectedDistrict) {
      return [51, 255, 51];
    }
    const party = Ku2Party[kuname]?.kaiha;
    const color = Party2RGBColor[party];
    if (color === undefined) {
      return [255, 255, 255];
    }

    return color || [255, 255, 255];
  };

  const geojsonLayer = new GeoJsonLayer({
    data: geoJsonData,
    opacity: 0.8,
    stroked: false,
    filled: true,
    extruded: true,
    wireframe: true,
    // eslint-disable-next-line no-unused-vars
    getElevation: (f) => 100,
    getFillColor: (f) => getFillColor(f),
    getLineColor: [0, 0, 0],
    // eslint-disable-next-line no-unused-vars
    onClick: (info, event) => {
      const { kuname } = info.object.properties;
      setCurrentDistrict(kuname.replace('区', ''));
    },
    updateTriggers: {
      getFillColor: [selectedDistrict],
    },
    pickable: true,
  });
  return (
    <div className="relative h-full">
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller
        layers={[geojsonLayer]}
        getTooltip={getToolTip}
      >
        <Map
          mapboxAccessToken={REACT_APP_MAPBOX_ACCESS_TOKEN}
          reuseMaps
          mapStyle={MAP_STYLE}
          preventStyleDiffing
          projection="mercator"
        />
      </DeckGL>
    </div>
  );
}

VoteDistrictMap.defaultProps = {
  setCurrentDistrict: () => {},
  selectedDistrict: '',
  geoJsonData: {},
};

VoteDistrictMap.propTypes = {
  setCurrentDistrict: Proptypes.func,
  // eslint-disable-next-line react/forbid-prop-types
  geoJsonData: Proptypes.object,
  selectedDistrict: Proptypes.string,
};

export default VoteDistrictMap;
