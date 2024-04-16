import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { reprsEndpoint } from 'resource/resources';
import { Link } from 'react-router-dom';
import { cleanReprName } from 'utils';
import { colors } from 'resource/styling';

function DistrictRepsPanel({ house, reprs }) {
  return (
    <div className="h-[50%] w-full flex flex-col justify-around relative border-y-2">
      <h2 className="mx-1 text-2xl font-bold">{house}</h2>
      <div className="h-[90%] overflow-y-scroll">
        {reprs?.map((repr) => {
          const reprUrl = `/repr_analysis/speech/${repr.kaiha}/${cleanReprName(
            repr.name
          )}`;
          return (
            <Link to={reprUrl} key={reprUrl}>
              <div
                className={`my-2 mx-4 py-2 px-1 border-2 rounded-lg grow-on-hover-medium ${colors.primary}`}
              >
                <h3 className="text-xl">{cleanReprName(repr.name)}</h3>
                <p>{repr.yomikata}</p>
                <p>会派：{repr.kaiha}</p>
                <p>選挙区：{repr.district}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

DistrictRepsPanel.propTypes = {
  house: PropTypes.string.isRequired,
  reprs: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      district: PropTypes.string,
      kaiha: PropTypes.string,
      yomikata: PropTypes.string,
    })
  ).isRequired,
};

function DistrictRepsPanelContainer({ districtName }) {
  // eslint-disable-next-line no-unused-vars
  const [lowerReprs, setLowerReprs] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [upperReprs, setUpperReprs] = useState([]);
  const houses = ['衆議院', '参議院'];
  const reprs = [lowerReprs, upperReprs];

  useEffect(() => {
    if (!districtName) return;
    const requestUrl = `${reprsEndpoint}${districtName}`;
    axios.get(requestUrl).then((res) => {
      setLowerReprs(res.data.lower_reprs);
      setUpperReprs(res.data.upper_reprs);
    });
  }, [districtName]);
  return (
    <div className="relative h-full flex flex-col justify-center items-center ">
      {districtName ? (
        houses.map((house, idx) => (
          <DistrictRepsPanel key={house} house={house} reprs={reprs[idx]} />
        ))
      ) : (
        <h1 className="mx-1 text-lg font-bold">選挙区を選択してください</h1>
      )}
    </div>
  );
}

DistrictRepsPanelContainer.defaultProps = {
  districtName: '',
};

DistrictRepsPanelContainer.propTypes = {
  districtName: PropTypes.string,
};

export default DistrictRepsPanelContainer;
