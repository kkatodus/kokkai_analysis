import React, { useEffect, useState } from "react";
import BasePageLayout from "../layouts/BasePageLayout";

import { sangiinEndpoint } from "../resource/resources";

import "../styles/sanitize.css";
import "../styles/general.css";

import MeetingCard from "../components/meetingCard";

/**
 * @return {JSX.Element}
 */
function SangiinMeetingsPage() {
  const [meetingNames, setMeetingNames] = useState([]);
  const [isloading, setIsLoading] = useState(true);
  const [meetingNameCards, setCards] = useState("");

  useEffect(() => {
    // gets called on mount of the component

    const fetchMeetingNames = async () => {
      const meetingNamesData = await fetch(sangiinEndpoint + "meeting_names");
      const meetingNamesJson = await meetingNamesData.json();
      setMeetingNames(meetingNamesJson.meetings.reverse());
    };
    // get the meetings if the array is empty in store
    setIsLoading(true);
    fetchMeetingNames().catch(() => {
      console.error();
      setIsLoading(true);
    });
  }, []);

  useEffect(() => {
    if (meetingNames.length === 0) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
      const cards = meetingNames.map((meetingName) => {
        return <MeetingCard key={meetingName.meeting_name} {...meetingName} />;
      });
      setCards(cards);
    }
  }, [meetingNames]);
  const PageContent = isloading ? <h1>Loading</h1> : meetingNameCards;
  return (
    <BasePageLayout
      backTo="/sangiin_menu"
      pageTitle="投票記録"
      MainContent={PageContent}
    />
  );
}

export default SangiinMeetingsPage;
