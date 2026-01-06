import { useEffect, useState } from "react";
import { GeoJsonLayer } from '@deck.gl/layers';
import DeckGL from '@deck.gl/react';
import {Map} from 'react-map-gl/maplibre';
import type { PickingInfo } from 'deck.gl';
import { PARTY2RGBCOLOR } from '@/app/lib/config/parties';
// import useLowerKu2Party from 'state/useLowerKu2Party';

// eslint-disable-next-line no-unused-vars

const INITIAL_VIEW_STATE = {
  longitude: 136.4354,
  latitude: 35.166212,
  zoom: 6,
  pitch: 60,
  bearing: -20,
};

const MAP_STYLE = 'mapbox://styles/kkatodus/clnkx6x1z002601p7c4vl398t';


interface VoteDistrictMapProps {
  geoJsonData: any;
  selectedDistrict: string | null;
  setCurrentDistrict: (district: string) => void;
  ku2Party: {[key:string]:{name:string, yomikata:string, kaiha:string}}
  resetCounter?: number;
}


function VoteDistrictMap({
  setCurrentDistrict,
  geoJsonData,
  selectedDistrict,
  ku2Party,
  resetCounter,

}: VoteDistrictMapProps) {
  // Geojson data for voting districts
//   const [Ku2Party] = useLowerKu2Party();

  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);

  useEffect(() => {
    setViewState(INITIAL_VIEW_STATE);
  }, [resetCounter]);



  const getToolTip = ({object} : PickingInfo) => {
    if (object) {
      	const kuname = object.properties?.kuname;
		return `${kuname}`
    }
    return null;
  };
  const getFillColor : (f: any) => [number, number, number] = (f: any) => {
    let { kuname } = f.properties;
    kuname = kuname.replace('区', '');
    if (kuname === selectedDistrict) {
      return [51, 255, 51];
    }
    const party = ku2Party[kuname]?.kaiha;
    const color = PARTY2RGBCOLOR[party];
    // if (color === undefined) {
    //   return [255, 255, 255];
    // }

    return color || [255, 255, 255];
  };

  const getElevation : (f: any) => number = (f: any) => {
    let { kuname } = f.properties;
    kuname = kuname.replace('区', '');
    if (kuname === selectedDistrict) {
      return 10000;
    }
    return 0;
  };

  const geojsonLayer = new GeoJsonLayer({
    data: geoJsonData,
    opacity: 0.8,
    stroked: false,
    filled: true,
    extruded: true,
    wireframe: true,
    // eslint-disable-next-line no-unused-vars
    getElevation: getElevation,
    getFillColor: getFillColor,
    getLineColor: [255, 255, 255],
    // eslint-disable-next-line no-unused-vars
    onClick: (info, event) => {
      const { kuname } = info.object.properties;
      setCurrentDistrict(kuname.replace('区', ''));
    },
    updateTriggers: {
      getFillColor: [selectedDistrict],
      getElevation: [selectedDistrict],
    },
    pickable: true,
  });
  return (
    <div className="relative h-[500px] ">
      <DeckGL
        viewState={viewState as any}
        onViewStateChange={({ viewState: next }) => setViewState(next as any)}
        controller
        layers={[geojsonLayer]}
        getTooltip={getToolTip}
      >
        <Map
		  
        //   mapboxAccessToken={NEXT_PUBLIC_REACT_APP_MAPBOX_ACCESS_TOKEN}
          reuseMaps
        //   mapStyle={MAP_STYLE}
        //   preventStyleDiffing
          projection="mercator"
          {...(viewState as any)}
        />
      </DeckGL>
    </div>
  );
}




export default VoteDistrictMap;
