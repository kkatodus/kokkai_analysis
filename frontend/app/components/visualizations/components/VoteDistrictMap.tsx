import { useEffect, useRef, useState } from "react";
import { GeoJsonLayer } from '@deck.gl/layers';
import DeckGL from '@deck.gl/react';
import {Map} from 'react-map-gl/maplibre';
import type { PickingInfo } from 'deck.gl';
import { PARTY2RGBCOLOR, PARTY_FALLBACK_RGB } from '@/app/lib/config/parties';
// import useLowerKu2Party from 'state/useLowerKu2Party';

// eslint-disable-next-line no-unused-vars

const INITIAL_VIEW_STATE = {
  longitude: 136.4354,
  latitude: 35.166212,
  zoom: 6,
  pitch: 60,
  bearing: -20,
};

// Idle spin: degrees of bearing per second, and how long after the user lets go before it resumes.
const AUTO_ROTATE_DEG_PER_SEC = 4;
const AUTO_ROTATE_RESUME_MS = 3000;

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

  // Slowly orbit the map while nobody is touching it. Any drag/zoom pauses the spin;
  // it picks up again from wherever the user left the camera once they've been idle a moment.
  const interactingRef = useRef(false);
  const lastInteractionRef = useRef(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - prev, 100); // avoid a jump after a backgrounded tab
      prev = now;
      if (!interactingRef.current && now - lastInteractionRef.current > AUTO_ROTATE_RESUME_MS) {
        setViewState((v) => ({ ...v, bearing: (v.bearing + (AUTO_ROTATE_DEG_PER_SEC * dt) / 1000) % 360 }));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);



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
    return PARTY2RGBCOLOR[party] || PARTY_FALLBACK_RGB;
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
    <div className="relative h-[500px] overflow-hidden rounded-lg">
      <DeckGL
        viewState={viewState as any}
        onViewStateChange={({ viewState: next, interactionState }) => {
          if (interactionState && Object.values(interactionState).some(Boolean)) {
            lastInteractionRef.current = performance.now();
          }
          setViewState(next as any);
        }}
        onInteractionStateChange={(state) => {
          interactingRef.current = Object.values(state).some(Boolean);
          lastInteractionRef.current = performance.now();
        }}
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
