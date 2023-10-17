import React, { useEffect, useState } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import { AiOutlineLink } from 'react-icons/ai';
import { MdKeyboardArrowRight, MdKeyboardArrowLeft } from 'react-icons/md';
import { colors } from '../../../resource/styling';
import { speechEndpoint } from '../../../resource/resources';
import { squareLoader } from '../../../resource/loader';

function ReprTopicOpinionCard(props) {
  const { topic, idxOptions, reprName, party } = props;
  const idxOptionsArr = Array.from({ length: idxOptions }, (_, i) => i + 1);
  const [uiIdxOptionArr, setUiIdxOptionArr] = useState(
    Array.from({ length: idxOptions }, (_, i) => i + 1)
  );
  const [speeches, setSpeeches] = useState(null);
  const [targetFileIdx, setTargetFileIdx] = useState(1);

  const updateRangeofIdx = (selectedIdx) => {
    if (idxOptionsArr.length < 4) {
      return idxOptionsArr;
    }
    if (selectedIdx < 2) {
      return [1, 2, 3, 4, 5];
    }
    if (selectedIdx > idxOptionsArr.length - 3) {
      return [
        idxOptionsArr.length - 5,
        idxOptionsArr.length - 4,
        idxOptionsArr.length - 3,
        idxOptionsArr.length - 2,
        idxOptionsArr.length - 1,
      ];
    }
    return [
      selectedIdx - 2,
      selectedIdx - 1,
      selectedIdx,
      selectedIdx + 1,
      selectedIdx + 2,
    ];
  };

  useEffect(() => {
    const requestUrl = `${speechEndpoint}opinion/${party}/${reprName}/${topic}/${targetFileIdx}`;
    // eslint-disable-next-line no-console
    console.log(requestUrl);
    axios({
      method: 'get',
      url: requestUrl,
    })
      .then((res) => {
        setSpeeches(res.data.speeches);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.log(err);
      });
    setUiIdxOptionArr(updateRangeofIdx(targetFileIdx));
  }, []);

  useEffect(() => {
    axios({
      method: 'get',
      url: `${speechEndpoint}/opinion/${party}/${reprName}/${topic}/${targetFileIdx}`,
    })
      .then((res) => {
        setSpeeches(res.data.speeches);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.log(err);
      });
    setUiIdxOptionArr(updateRangeofIdx(targetFileIdx));
  }, [targetFileIdx]);

  return (
    <div className="flex items-center justify-center relative w-full h-5/6 sm:w-full md:w-1/2 lg:w-1/2 p-3">
      <div className="w-[98%] h-[98%] border-[5px] p-2 rounded-lg flex flex-col items-center justify-start">
        <div className="w-full mb-2 flex justify-between">
          <h1 className="text-3xl text-left">{topic}</h1>
          <div className="flex items-center justify-center w-[50%] ">
            {idxOptionsArr.length > 4 && (
              <MdKeyboardArrowLeft
                className="cursor-pointer"
                onClick={() => setTargetFileIdx(Math.max(targetFileIdx - 1, 0))}
              />
            )}
            {idxOptionsArr.length === 1
              ? ''
              : uiIdxOptionArr.map((value) => {
                  const selected = value === targetFileIdx;
                  // eslint-disable-next-line jsx-a11y/control-has-associated-label
                  return (
                    <button
                      type="button"
                      onClick={() => setTargetFileIdx(value)}
                      aria-label=""
                      className={`h-7 w-7 rounded-lg mx-1 ${
                        selected ? colors.primary : colors.secondary
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
            {idxOptionsArr.length > 4 && (
              <MdKeyboardArrowRight
                className="cursor-pointer"
                onClick={() =>
                  setTargetFileIdx(Math.min(targetFileIdx + 1, idxOptions - 1))
                }
              />
            )}
          </div>
        </div>
        <div className="h-full w-full overflow-y-scroll flex flex-col items-center">
          {speeches
            ? speeches.map((speech) => {
                // eslint-disable-next-line camelcase
                const { speech_url, extracted_opinions, date } = speech;
                return (
                  // eslint-disable-next-line camelcase
                  <div href={speech_url} className="border-2 m-2 w-[95%] p-1">
                    <div className="flex items-center justify-between text-2xl">
                      <h1>{date}</h1>
                      {/* eslint-disable-next-line camelcase */}
                      <a href={speech_url}>
                        <AiOutlineLink />
                      </a>
                    </div>
                    {/* eslint-disable-next-line camelcase */}
                    {extracted_opinions.map((opinion) => (
                      <p
                        className={`w-full mb-2 rounded-xl p-1 ${colors.primary}`}
                      >
                        {opinion}
                      </p>
                    ))}
                  </div>
                );
              })
            : squareLoader}
        </div>
      </div>
    </div>
  );
}

ReprTopicOpinionCard.defaultProps = {};
ReprTopicOpinionCard.propTypes = {
  topic: PropTypes.string.isRequired,
  idxOptions: PropTypes.arrayOf(PropTypes.number).isRequired,
  reprName: PropTypes.string.isRequired,
  party: PropTypes.string.isRequired,
};

export default ReprTopicOpinionCard;
