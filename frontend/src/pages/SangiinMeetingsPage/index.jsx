import React, { useEffect, useState } from 'react';
import BasePageLayout from '../../layouts/BasePageLayout';

import { sangiinEndpoint } from '../../resource/resources';

import MeetingCard from './components/MeetingCard';
import { gridLoader } from '../../resource/loader';

/**
 * @return {JSX.Element}
 */
function SangiinMeetingsPage() {
  const [meetingNames, setMeetingNames] = useState(null);

  useEffect(() => {
    // gets called on mount of the component

    const fetchMeetingNames = async () => {
      const meetingNamesData = await fetch(`${sangiinEndpoint}meeting_names`);
      const meetingNamesJson = await meetingNamesData.json();
      setMeetingNames(meetingNamesJson.meetings.reverse());
    };
    // get the meetings if the array is empty in store
    fetchMeetingNames().catch(() => {
      /* eslint-disable no-console */
      console.error();
    });
  }, []);

  const PageContent = !meetingNames
    ? gridLoader
    : meetingNames.map((meetingName) => (
        <MeetingCard
          key={meetingName.meeting_name}
          MeetingName={meetingName.meeting_name}
          Period={meetingName.period}
        />
      ));
  return (
    <BasePageLayout
      backTo="/sangiin_menu"
      pageTitle="投票記録"
      MainContent={PageContent}
      extraStyles={{ content: 'flex flex-col items-center' }}
    />
  );
}

export default SangiinMeetingsPage;
