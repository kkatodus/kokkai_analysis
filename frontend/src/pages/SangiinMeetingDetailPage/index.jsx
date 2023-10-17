import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { sangiinEndpoint } from '../../resource/resources';
import BasePageLayout from '../../layouts/BasePageLayout';
import TopicCard from './components/TopicCard';
import { gridLoader } from '../../resource/loader';

/* eslint-disable no-nested-ternary */
/**
 *
 * @return {JSX.Element}
 */
function SangiinMeetingDetailPage() {
  const [meeting, setMeeting] = useState(null);
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
    fetchMeeting().catch(() => {
      /* eslint-disable no-console */
      console.error();
    });
  }, [meetingId]);

  const content = !meeting ? (
    gridLoader
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
      pageSubtitle={meeting?.period}
      MainContent={content}
      backTo="/sangiin_meetings"
      extraStyles={{ content: 'items-center' }}
    />
  );
}

export default SangiinMeetingDetailPage;
