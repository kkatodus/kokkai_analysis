import React, { useEffect, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { Link } from 'react-router-dom';
import { ColumnLayer } from '@deck.gl/layers';
import axios from 'axios';
import Map from 'react-map-gl';
import { MdOutlineArrowBack } from 'react-icons/md';
import Slider from '@mui/material/Slider';
import Div100vh from 'react-div-100vh';
import 'mapbox-gl/dist/mapbox-gl.css';
import { statsEndpoint } from '../../../resource/resources';
import DataTable from '../../../sharedComponents/DataTable';
import useCityPopulationData from '../../../state/useCityPopulationData';
import sortDataByPopulation from './utils/sortDataByPopulation';
import getPopulationValueFromRow from './utils/getPopulationValueFromData';
import { colors } from '../../../resource/styling';

const MAP_STYLE = 'mapbox://styles/kkatodus/clnkx6x1z002601p7c4vl398t';
// eslint-disable-next-line no-unused-vars
const { REACT_APP_MAPBOX_ACCESS_TOKEN } = process.env;

const cityPopulationEndpoint = `${statsEndpoint}city_population_over_years`;

const INITIAL_VIEW_STATE = {
  longitude: 136.4354,
  latitude: 35.166212,
  zoom: 6,
  pitch: 60,
  bearing: -20,
};

const marks = [
  { value: 1980, label: '1980' },
  { value: 1985, label: '1985' },
  { value: 1990, label: '1990' },
  { value: 1995, label: '1995' },
  { value: 2000, label: '2000' },
  { value: 2005, label: '2005' },
  { value: 2010, label: '2010' },
  { value: 2015, label: '2015' },
  { value: 2020, label: '2020' },
];

function PopulationPage() {
  const [year, setYear] = useState(1980);
  const { cityPopulationDataState, updateCityPopulationDataState } =
    useCityPopulationData();
  const sortedCityData = sortDataByPopulation(
    cityPopulationDataState || [],
    Number(year)
  );
  console.log('sorted city data', sortedCityData);

  const dataGridColumns = [
    {
      field: 'city',
      headerName: '市区町村',
      type: 'string',
      width: 200,
    },
    {
      field: 'population',
      headerName: '人口',
      width: 100,
      valueGetter: (params) => getPopulationValueFromRow(params, Number(year)),
    },
  ];

  useEffect(() => {
    axios.get(cityPopulationEndpoint).then((res) => {
      updateCityPopulationDataState(res.data);
    });
  }, []);

  const getTooltip = ({ object }) => {
    if (!object) {
      return null;
    }
    const count = object.populationByYear[year];
    const { city } = object;

    return `${city}\n${count} 人 `;
  };

  const handleYearChange = (event, newValue) => {
    setYear(newValue);
  };

  const getFillColor = (d) => {
    const maxPopulation = 3000000;
    const startColor = [250, 248, 110];
    const endColor = [244, 6, 6];
    const population = d.populationByYear[year];
    const ratio = population / maxPopulation;
    const color = [
      startColor[0] + (endColor[0] - startColor[0]) * ratio,
      startColor[1] + (endColor[1] - startColor[1]) * ratio,
      startColor[2] + (endColor[2] - startColor[2]) * ratio,
      100,
    ];
    return color;
  };
  const layers = [
    new ColumnLayer({
      id: 'column-layer',
      data: cityPopulationDataState,
      radius: 2000,
      angle: 0,
      extruded: true,
      pickable: true,
      coverage: 1,
      elevationScale: 1,
      elevationRange: [0, 1400000],
      getPosition: (d) => [d.long, d.lat],
      // eslint-disable-next-line no-unused-vars
      updateTriggers: {
        getElevation: year,
        getFillColor: year,
      },
      getLineWidth: 1,
      getFillColor,
      upperPercentile: 100,
      getElevation: (d) => Number(d.populationByYear[year] / 5),
      transitions: {
        getElevation: 1000,
      },
    }),
  ];

  return (
    <Div100vh>
      <div className="relative h-[99%] w-screen">
        <Link
          className={`back-icon absolute z-40 top-0 left-0 p-2 rounded-lg ${colors.primary}`}
          to="/stats"
        >
          <MdOutlineArrowBack className="menu-icon h-[50px] w-[50px] " />
        </Link>
        <div className="flex h-[90%] relative">
          <DeckGL
            initialViewState={INITIAL_VIEW_STATE}
            controller
            layers={layers}
            style={{ position: 'relative', height: '100%', width: '70%' }}
            getTooltip={getTooltip}
          >
            <Map
              mapboxAccessToken={REACT_APP_MAPBOX_ACCESS_TOKEN}
              reuseMaps
              mapStyle={MAP_STYLE}
              preventStyleDiffing
              projection="mercator"
            />
          </DeckGL>
          <div className="h-[100%] w-[30%]">
            <DataTable
              data={sortedCityData}
              columns={dataGridColumns}
              getRowId={(row) => row.city}
            />
          </div>
        </div>
        <div className="h-[70px] w-[80%] mx-10 flex items-center justify-center">
          <Slider
            aria-label="Year"
            value={year}
            onChange={handleYearChange}
            min={1980}
            max={2020}
            step={5}
            marks={marks}
          />
        </div>
      </div>
    </Div100vh>
  );
}

export default PopulationPage;
