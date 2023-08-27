import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { sangiinEndpoint } from '../resource/resources';
import '../styles/general.css';
import '../styles/pages/meeting_detail_page.css';
import BasePageLayout from '../layouts/BasePageLayout';
import TopicCard from '../components/TopicCard';
// import TopicCard from '../components/TopicCard';

/* eslint-disable no-nested-ternary */
/**
 *
 * @return {JSX.Element}
 */
function MeetingDetailPage() {
  const [meeting, setMeeting] = useState({ topics: [] });
  const [isloading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  // eslint-disable-next-line camelcase
  const { meetingId } = useParams();
  useEffect(() => {
    // gets called on mount of the component
    const fetchMeeting = async () => {
      // eslint-disable-next-line max-len, camelcase
      const meetingUrl = `${sangiinEndpoint}sangiin_meeting_votes/${meetingId}`;
      const meetingData = await fetch(meetingUrl);
      const meetingJson = await meetingData.json();
      setMeeting(meetingJson);
    };
    setIsLoading(true);
    fetchMeeting().catch(() => {
      /* eslint-disable no-console */
      console.error();
      setLoadFailed(true);
    });
    setIsLoading(false);
  }, [meetingId]);

  const content = isloading ? (
    <h1>Loading</h1>
  ) : loadFailed ? (
    <h1>Load failed</h1>
  ) : (
    <div className="card-container ">
      {meeting.topics.map((topic) => (
        <TopicCard
          key={topic.topic_title + topic.topic_date}
          meetingId={meetingId}
          topic={topic}
        />
      ))}
    </div>
  );

  return (
    <BasePageLayout
      pageTitle={`${meetingId}`}
      pageSubtitle={meeting.period}
      MainContent={content}
      backTo="/sangiin_meetings"
    />
  );
}

export default MeetingDetailPage;
