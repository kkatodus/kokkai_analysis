import React, { useEffect, useState } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import { AiOutlineLink } from 'react-icons/ai';
import { colors } from '../resource/styling';
import { speechEndpoint } from '../resource/resources';

function ReprTopicOpinionCard(props) {
  const { topic, idxOptions, reprName, party } = props;
  const [speeches, setSpeeches] = useState(null);

  console.log(idxOptions);
  console.log(speeches);
  useEffect(() => {
    axios({
      method: 'get',
      url: `${speechEndpoint}/opinion/${party}/${reprName}/${topic}/0`,
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
        <h1 className="text-3xl text-left w-full mb-2">{topic}</h1>
        <div className="h-full w-full overflow-y-scroll flex flex-col items-center">
          {speeches ? (
            speeches.map((speech) => {
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
          ) : (
            <h1>Loading</h1>
          )}
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
