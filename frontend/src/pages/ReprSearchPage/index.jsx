import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { geoEndpoint } from 'resource/resources';
import Div100vh from 'react-div-100vh';
import { Link } from 'react-router-dom';
import { MdOutlineArrowBack } from 'react-icons/md';
import { colors } from 'resource/styling';
import ModalManager from 'modals';

import VoteDistrictMap from './components/VoteDistrictMap';
import DistrictRepsPanel from './components/DistrictRepsPanel';
import MapLegend from './components/Legend';
import AutocompleteInput from './components/AutocompleteInput';

function ReprSearchPage() {
  // eslint-disable-next-line no-unused-vars
  const [searchMode, setSearchMode] = useState('map');
  const [geoJsonData, setGeojsonData] = useState(null);
  const districtOptions = useMemo(
    () =>
      geoJsonData?.features.map((f) => f.properties.kuname.replace('区', '')),
    [geoJsonData]
  );
  const [selectedDistrict, setSelectedDistrict] = useState(null);

  useEffect(() => {
    const requestUrl = `${geoEndpoint}/senkyokuPolydata`;
    axios({
      method: 'get',
      url: requestUrl,
    })
      .then((res) => {
        setGeojsonData(res.data);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.log(err);
      });
  }, []);

  return (
    <Div100vh>
      <div className="relative h-[100%] w-screen flex">
        <ModalManager />
        <div className="absolute h-20 w-[70%] z-10">
          <div className="w-full flex h-full">
            <Link
              className={`back-icon z-40 top-0 left-0 p-2 rounded-lg ${colors.primary}`}
              to="/repr_analysis"
            >
              <MdOutlineArrowBack className="menu-icon h-[50px] w-[50px] " />
            </Link>
            <MapLegend />
          </div>
          <div className="w-full h-20 pt-2 pl-2">
            <AutocompleteInput
              selectedDistrict={selectedDistrict}
              setSelectedDistrict={setSelectedDistrict}
              options={districtOptions}
            />
          </div>
        </div>
        <div className="w-[70%] h-full">
          <VoteDistrictMap
            setCurrentDistrict={setSelectedDistrict}
            selectedDistrict={selectedDistrict}
            geoJsonData={geoJsonData}
          />
        </div>
        <div className="w-[30%]">
          <DistrictRepsPanel districtName={selectedDistrict} />
        </div>
      </div>
    </Div100vh>
  );
}

export default ReprSearchPage;
