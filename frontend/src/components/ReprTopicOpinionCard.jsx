import React from 'react';
import PropTypes from 'prop-types';
import { AiOutlineLink } from 'react-icons/ai';
import { colors } from '../resource/styling';

function ReprTopicOpinionCard(props) {
  const { opinionsByTopic } = props;
  const { topic, data } = opinionsByTopic;
  const { speeches } = data;
  return (
    <div className="flex items-center justify-center relative w-full h-5/6 sm:w-full md:w-1/2 lg:w-1/2 p-3">
      <div className="w-[98%] h-[98%] border-[5px] p-2 rounded-lg flex flex-col items-center justify-start">
        <h1 className="text-3xl text-left w-full">{topic}</h1>
        <div className="h-full w-full overflow-y-scroll flex flex-col items-center">
          {speeches?.map((speech) => {
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
                  <p className={`w-full mb-2 rounded-xl p-1 ${colors.primary}`}>
                    {opinion}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

ReprTopicOpinionCard.defaultProps = {};
ReprTopicOpinionCard.propTypes = {
  opinionsByTopic: PropTypes.shape({
    topic: PropTypes.string.isRequired,
    data: PropTypes.shape({
      speeches: PropTypes.arrayOf(
        PropTypes.shape({
          date: PropTypes.string.isRequired,
          extracted_opinions: PropTypes.arrayOf(PropTypes.string.isRequired)
            .isRequired,
          house_name: PropTypes.string.isRequired,
          meeting_name: PropTypes.string.isRequired,
          speaker_group: PropTypes.string.isRequired,
          speech_id: PropTypes.string.isRequired,
          speech_text: PropTypes.string.isRequired,
          speech_url: PropTypes.string.isRequired,
        })
      ),
    }).isRequired,
  }).isRequired,
};

export default ReprTopicOpinionCard;
