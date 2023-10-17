import React, { useEffect, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { ColumnLayer } from '@deck.gl/layers';
import Map from 'react-map-gl';
import axios from 'axios';
import 'mapbox-gl/dist/mapbox-gl.css';
import { statsEndpoint } from '../../resource/resources';

const MAP_STYLE = 'mapbox://styles/kkatodus/clnkx6x1z002601p7c4vl398t';
// eslint-disable-next-line no-unused-vars
const { REACT_APP_MAPBOX_ACCESS_TOKEN, REACT_APP_ESTAT_APPID } = process.env;

const city2PosEndpoint = `${statsEndpoint}city2posjson`;
const populationChangeEndpoint = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?cdCat01=A1101&appId=${REACT_APP_ESTAT_APPID}&lang=J&statsDataId=0000020201&metaGetFlg=Y&cntGetFlg=N&explanationGetFlg=Y&annotationGetFlg=Y&sectionHeaderFlg=1&dataFormat=J`;

const INITIAL_VIEW_STATE = {
  longitude: 139.6503,
  latitude: 35.6762,
  zoom: 4,
  pitch: 0,
  bearing: 0,
};

const data = [
  //   { name: 'Hokkaido', population: 5381733, coordinates: [141.3469, 43.0646] },
  //   { name: 'Aomori', population: 1261810, coordinates: [140.7407, 40.8221] },
  //   { name: 'Iwate', population: 1227156, coordinates: [141.1527, 39.7036] },
  //   { name: 'Miyagi', population: 2304567, coordinates: [140.8704, 38.2688] },
  //   { name: 'Akita', population: 966157, coordinates: [140.1024, 39.7186] },
  //   { name: 'Yamagata', population: 1079589, coordinates: [140.1034, 38.2554] },
  //   { name: 'Fukushima', population: 1848071, coordinates: [140.4676, 37.7503] },
  //   { name: 'Ibaraki', population: 2916976, coordinates: [140.4468, 36.3418] },
  //   { name: 'Tochigi', population: 1974255, coordinates: [139.8836, 36.5659] },
  //   { name: 'Gunma', population: 1973115, coordinates: [139.0609, 36.3912] },
  //   { name: 'Saitama', population: 7266534, coordinates: [139.6489, 35.8617] },
  //   { name: 'Chiba', population: 6222666, coordinates: [140.1233, 35.6047] },
  //   { name: 'Tokyo', population: 13929286, coordinates: [139.6503, 35.6762] },
  //   { name: 'Kanagawa', population: 9163085, coordinates: [139.6424, 35.4478] },
  //   { name: 'Niigata', population: 2221099, coordinates: [139.0236, 37.9022] },
  //   { name: 'Toyama', population: 1066328, coordinates: [137.2113, 36.6959] },
  //   { name: 'Ishikawa', population: 1154008, coordinates: [136.6256, 36.5947] },
  //   { name: 'Fukui', population: 767289, coordinates: [136.2215, 36.0652] },
  //   { name: 'Yamanashi', population: 817835, coordinates: [138.5683, 35.6642] },
  //   { name: 'Nagano', population: 2098804, coordinates: [138.1812, 36.6513] },
  //   { name: 'Gifu', population: 2031903, coordinates: [136.7223, 35.4233] },
  //   { name: 'Shizuoka', population: 3656585, coordinates: [138.3831, 34.9769] },
  //   { name: 'Aichi', population: 7483128, coordinates: [136.9066, 35.1802] },
  //   { name: 'Mie', population: 1791974, coordinates: [136.5086, 34.7303] },
  //   { name: 'Shiga', population: 1412916, coordinates: [136.0789, 35.2155] },
  //   { name: 'Kyoto', population: 2557150, coordinates: [135.7557, 35.0212] },
  //   { name: 'Osaka', population: 8839469, coordinates: [135.5022, 34.6937] },
  //   { name: 'Hyogo', population: 5500445, coordinates: [135.183, 34.6913] },
  //   { name: 'Nara', population: 1364316, coordinates: [135.8048, 34.6851] },
  //   { name: 'Wakayama', population: 944320, coordinates: [135.1675, 33.9094] },
  //   { name: 'Tottori', population: 555352, coordinates: [134.2384, 35.5039] },
  //   { name: 'Shimane', population: 694352, coordinates: [132.9939, 35.4722] },
  //   { name: 'Okayama', population: 1916774, coordinates: [133.919, 34.8964] },
  //   { name: 'Hiroshima', population: 2843990, coordinates: [132.4594, 34.3852] },
  //   { name: 'Yamaguchi', population: 1353866, coordinates: [131.4714, 34.1785] },
  //   { name: 'Tokushima', population: 728633, coordinates: [134.5594, 33.9192] },
  //   { name: 'Kagawa', population: 956069, coordinates: [133.8683, 34.2439] },
  //   { name: 'Ehime', population: 1385262, coordinates: [132.7666, 33.8417] },
  //   { name: 'Kochi', population: 697748, coordinates: [133.5311, 33.5597] },
  //   { name: 'Fukuoka', population: 5101556, coordinates: [130.4181, 33.6068] },
  //   { name: 'Saga', population: 832832, coordinates: [130.2988, 33.2494] },
  //   { name: 'Nagasaki', population: 1325645, coordinates: [129.8736, 32.7503] },
  //   { name: 'Kumamoto', population: 1743135, coordinates: [130.7417, 32.8032] },
  //   { name: 'Oita', population: 1140324, coordinates: [131.6126, 33.2382] },
  //   { name: 'Miyazaki', population: 1070625, coordinates: [131.4239, 31.9111] },
  //   { name: 'Kagoshima', population: 1608189, coordinates: [130.5581, 31.5602] },
  //   { name: 'Okinawa', population: 1433566, coordinates: [127.6809, 26.2124] },
  { name: 'Akitakata', population: 29481, coordinates: [132.883333, 34.85] },
];

function getTooltip({ object }) {
  if (!object) {
    return null;
  }
  const lat = object.coordinates[1];
  const lng = object.coordinates[0];
  const count = object.population;

  return `\
	  latitude: ${Number.isFinite(lat) ? lat.toFixed(6) : ''}
	  longitude: ${Number.isFinite(lng) ? lng.toFixed(6) : ''}
	  ${count} People`;
}

function getMaxPopulation() {
  return data.reduce(
    (max, p) => (p.population > max ? p.population : max),
    data[0].population
  );
}

const maxPopulation = getMaxPopulation();
function StatsPage() {
  const [city2posData, setCity2PosData] = useState(null);
  const [populationChangeData, setPopulationChangeData] = useState(null);

  useEffect(() => {
    axios({
      method: 'get',
      url: city2PosEndpoint,
    }).then((res) => {
      setCity2PosData(res.data);
    });
    axios({
      method: 'get',
      url: populationChangeEndpoint,
    }).then((res) => {
      setPopulationChangeData(res.data);
    });
  }, []);

  console.log(city2posData);
  console.log(populationChangeData);

  const layers = [
    new ColumnLayer({
      id: 'column-layer',
      data,
      radius: 2000,
      angle: 0,
      extruded: true,
      pickable: true,
      coverage: 1,
      elevationScale: 1000,
      elevationRange: [0, 1500],
      getPosition: (d) => d.coordinates,
      // eslint-disable-next-line no-unused-vars
      getFillColor: (d) => [
        Math.floor((255 * d.population) / maxPopulation),
        50,
        50,
      ],
      // eslint-disable-next-line no-unused-vars
      getLineColor: (d) => [0, 0, 0],
      getLineWidth: 1,
      upperPercentile: 100,
      getElevation: (d) => d.population / 10000,
      transitions: {
        elevationScale: 3000,
      },
    }),
  ];

  return (
    <DeckGL
      initialViewState={INITIAL_VIEW_STATE}
      controller
      layers={layers}
      style={{ position: 'relative', height: '80vh', width: '80%' }}
      getTooltip={getTooltip}
    >
      <Map
        mapboxAccessToken={REACT_APP_MAPBOX_ACCESS_TOKEN}
        reuseMaps
        mapStyle={MAP_STYLE}
        preventStyleDiffing
      />
    </DeckGL>
  );
}

export default StatsPage;
