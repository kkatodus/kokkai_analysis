import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { sangiinEndpoint } from '../resource/resources';
import '../styles/general.css';
import '../styles/pages/topic_detail_page.css';
import PartyOpinionCard from '../components/PartyOpinionCard';

/* eslint-disable no-nested-ternary */

/**
 * @return {JSX.Element}
 */
function SangiinTopicDetailPage() {
  const [topic, setTopic] = useState({});
  const [isloading, setIsLoading] = useState(true);
  const [noOpinions, setNoOpinions] = useState(false);
  const { meetingId, topicId } = useParams();

  useEffect(() => {
    const fetchTopic = async () => {
      const topicUrl = `${sangiinEndpoint}sangiin_party_opinions/${meetingId}/${topicId}`;
      const topicData = await fetch(topicUrl);
      const topicJson = await topicData.json();
      setTopic(topicJson);
    };

    setIsLoading(true);
    fetchTopic().catch(() => {
      /* eslint-disable no-console */
      console.error();
      setTopic({});
    });
    setIsLoading(false);
    if (Object.keys(topic).length !== 0) {
      setNoOpinions(false);
    } else {
      setNoOpinions(true);
    }
  }, [meetingId]);

  useEffect(() => {
    if (Object.keys(topic).length !== 0) {
      setNoOpinions(false);
    } else {
      setNoOpinions(true);
    }
  }, [topic]);

  const partyOpinionCards = Object.entries(topic).map(([key, value]) => (
    <PartyOpinionCard key={key} partyOpinion={value} partyName={key} />
  ));

  return (
    <div className="topic-detail-page">
      <div className="topic-name">
        <p>{topicId}</p>
      </div>
      <div className="content-section topic-detail-content">
        {isloading ? (
          <h1>Loading</h1>
        ) : noOpinions ? (
          <h1>該当する答弁がありません</h1>
        ) : (
          partyOpinionCards
        )}
      </div>
    </div>
  );
}

export default SangiinTopicDetailPage;
