import React, { useEffect, useState } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import { AiOutlineLink } from 'react-icons/ai';
import { squareLoader } from '../../../../resource/loader';
import {
  SpeechAbbrev2Kaiha,
  speechEndpoint,
} from '../../../../resource/resources';
import { colors } from '../../../../resource/styling';

function SpeechPanel({
  currentHouse,
  currentParty,
  currentRepr,
  currentTopic,
}) {
  const [speeches, setSpeeches] = useState(null);

  useEffect(() => {
    if (currentHouse && currentParty && currentRepr && currentTopic) {
      const requestUrl = `${speechEndpoint}opinion/${currentParty}/${currentRepr}/${currentTopic}`;
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
    }
  }, [currentHouse, currentParty, currentRepr, currentTopic]);
  if (!currentRepr) {
    return (
      <div className="w-full h-full flex justify-center items-center border-2">
        <h1 className="font-bold text-2xl">議員を選択してください</h1>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center relative h-full w-full">
      <div className="w-[98%] h-[98%] border-[5px] p-2 rounded-lg flex flex-col items-center justify-start">
        <div className="w-full mb-2 flex justify-between">
          {currentHouse}-{SpeechAbbrev2Kaiha[currentParty]}-{currentTopic}-
          {currentRepr}
        </div>
        <div className="h-full w-full overflow-y-scroll overflow-x-hidden flex flex-col items-center">
          {speeches
            ? speeches.map((speech) => {
                // eslint-disable-next-line camelcase
                const { speech_url, extracted_opinions, date } = speech;
                return (
                  <div
                    // eslint-disable-next-line camelcase
                    key={speech_url}
                    // eslint-disable-next-line camelcase
                    href={speech_url}
                    className="border-2 m-2 w-[95%] p-1"
                  >
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
                        key={opinion}
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
SpeechPanel.defaultProps = {
  currentHouse: null,
  currentParty: null,
  currentRepr: null,
  currentTopic: null,
};

SpeechPanel.propTypes = {
  currentHouse: PropTypes.string,
  currentParty: PropTypes.string,
  currentRepr: PropTypes.string,
  currentTopic: PropTypes.string,
};

export default SpeechPanel;
