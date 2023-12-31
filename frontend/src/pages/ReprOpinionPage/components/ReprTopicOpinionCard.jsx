import React, { useEffect, useState } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import { AiOutlineLink } from 'react-icons/ai';
import { colors } from '../../../resource/styling';
import { speechEndpoint } from '../../../resource/resources';
import { squareLoader } from '../../../resource/loader';

function ReprTopicOpinionCard(props) {
  const { house, topic, reprName, party } = props;

  const [speeches, setSpeeches] = useState(null);

  useEffect(() => {
    const requestUrl = `${speechEndpoint}opinion/${house}/${party}/${reprName}/${topic}`;
    // eslint-disable-next-line no-console
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
  }, []);

  return (
    <div className="flex items-center justify-center relative w-full h-5/6 sm:w-full md:w-1/2 lg:w-1/2 p-3">
      <div className="w-[98%] h-[98%] border-[5px] p-2 rounded-lg flex flex-col items-center justify-start">
        <div className="w-full mb-2 flex justify-between">
          <h1 className="text-3xl text-left">{topic}</h1>
        </div>
        <div className="h-full w-full overflow-y-scroll flex flex-col items-center">
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

ReprTopicOpinionCard.defaultProps = {};
ReprTopicOpinionCard.propTypes = {
  house: PropTypes.string.isRequired,
  topic: PropTypes.string.isRequired,
  reprName: PropTypes.string.isRequired,
  party: PropTypes.string.isRequired,
};

export default ReprTopicOpinionCard;
