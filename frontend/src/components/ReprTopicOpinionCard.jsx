import React from 'react';
import PropTypes from 'prop-types';
import { AiOutlineLink } from 'react-icons/ai';
import { colors } from '../resource/styling';

function ReprTopicOpinionCard(props) {
  const { opinionsByTopic } = props;
  const { topic, speeches } = opinionsByTopic;
  console.log(opinionsByTopic);
  console.log('speeches', speeches);
  console.log(topic);
  console.log(colors);
  return (
    <div className="flex items-center justify-center relative w-full h-5/6 sm:w-full md:w-1/2 lg:w-1/2 p-3">
      <div className="w-[98%] h-[98%] border-[5px] p-2 rounded-lg flex flex-col items-center justify-start">
        <h1 className="text-3xl text-left w-full">{topic}</h1>
        <div className="h-full w-full overflow-y-scroll flex flex-col items-center">
          {speeches.map((speech) => {
            const { speechLink, opinions, date } = speech;
            return (
              <div href={speechLink} className="border-2 m-2 w-[95%] p-1">
                <div className="flex items-center justify-between text-2xl">
                  <h1>{date}</h1>
                  <a href={speechLink}>
                    <AiOutlineLink />
                  </a>
                </div>
                {opinions.map((opinion) => (
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
    speeches: PropTypes.arrayOf(
      PropTypes.shape({
        speechLink: PropTypes.string.isRequired,
        opinions: PropTypes.arrayOf(PropTypes.string.isRequired),
      })
    ).isRequired,
  }).isRequired,
};

export default ReprTopicOpinionCard;
