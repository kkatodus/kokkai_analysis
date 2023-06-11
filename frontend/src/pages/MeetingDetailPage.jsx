import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MdOutlineArrowBack } from 'react-icons/md';

import { sangiinEndpoint } from '../resource/resources';
import '../styles/general.css';
import '../styles/pages/meeting_detail_page.css';
import TopicCard from '../components/TopicCard';

/* eslint-disable no-nested-ternary */
/**
 *
 * @return {JSX.Element}
 */
function MeetingDetailPage() {
  const [topicFilterText, setTopicFilterText] = useState('');
  const [meeting, setMeeting] = useState({ topics: [] });
  const [meetingPeriod, setPeriod] = useState('');
  const [isloading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [topicCards, setCards] = useState('');
  // eslint-disable-next-line camelcase
  const { meetingId } = useParams();
  useEffect(() => {
    // gets called on mount of the component
    const fetchMeeting = async () => {
      // eslint-disable-next-line max-len, camelcase
      const meetingUrl = `${sangiinEndpoint}"sangiin_meeting_votes/${meetingId}`;
      const meetingData = await fetch(meetingUrl);
      const meetingJson = await meetingData.json();
      setMeeting(meetingJson);
    };
    setIsLoading(true);
    fetchMeeting().catch(() => {
      console.error();
      setLoadFailed(true);
    });
    setIsLoading(false);
  }, [meetingId]);

  useEffect(() => {
    setPeriod(meeting.period);
    const cards = meeting.topics.map((topic) => {
      if (topicFilterText === '') {
        return (
          <TopicCard
            key={topic.topic_title + topic.topic_date}
            meetingId={meetingId}
            topic={topic}
          />
        );
      }
      if (topic.topic_title.includes(topicFilterText)) {
        return (
          <TopicCard
            key={topic.topic_title + topic.topic_date}
            meetingId={meetingId}
            topic={topic}
          />
        );
      }
      return '';
    });
    setCards(cards);
    if (meeting.topics.length !== 0) {
      setLoadFailed(false);
    }
  }, [meeting, topicFilterText, meetingId]);

  const handleTopicFilterInputChange = (e) => {
    setTopicFilterText(e.target.value);
  };

  return (
    <div className="meeting-detail-page">
      <div className="header-section">
        <Link className="back-icon" to="/sangiin_meetings">
          <MdOutlineArrowBack />
        </Link>
        <h2>{meetingId}</h2>
        <h3>{meetingPeriod}</h3>
      </div>
      <div className="user-input-container">
        <label className="input-label" htmlFor="topic-filter-input">
          フィルタ:{' '}
        </label>
        <input
          type="text"
          id="topic-filter-input"
          className="topic-filter-input"
          onChange={handleTopicFilterInputChange}
        />
      </div>
      <div className="content-section meeting-detail-content">
        {isloading ? (
          <h1>Loading</h1>
        ) : loadFailed ? (
          <h1>Load failed</h1>
        ) : (
          topicCards
        )}
      </div>
    </div>
  );
}

export default MeetingDetailPage;
