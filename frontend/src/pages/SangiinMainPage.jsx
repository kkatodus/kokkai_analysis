import React, {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {MdOutlineArrowBack} from 'react-icons/md';

import {sangiinEndpoint} from '../resource/resources';

import '../styles/sanitize.css';
import '../styles/general.css';

import MeetingCard from '../components/meetingCard';

/**
 * @return {JSX.Element}
*/
function SangiinMainPage() {
  const [meetingNames, setMeetingNames] = useState([]);
  const [isloading, setIsLoading] = useState(true);
  const [meetingNameCards, setCards] = useState('');

  useEffect(() => {
    // gets called on mount of the component

    const fetchMeetingNames = async () => {
      const meetingNamesData = await fetch(sangiinEndpoint + 'meeting_names');
      const meetingNamesJson = await meetingNamesData.json();
      setMeetingNames(meetingNamesJson['meetings']);
    };
    // get the meetings if the array is empty in store
    setIsLoading(true);
    fetchMeetingNames()
        .catch(() => {
          console.error();
          setIsLoading(true);
        });
  }, []);

  useEffect(()=>{
    if (meetingNames.length === 0) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
      const cards = meetingNames.map((meetingName) => {
        return (
          <MeetingCard
            key={meetingName['meeting_name']}
            {...meetingName} />
        );
      });
      setCards(cards);
    }
  }, [meetingNames]);
  return (
    <div className="full-page-container">
      <div className="header-section ">
        <Link className="back-icon" to="/">
          <MdOutlineArrowBack/>
        </Link>
        <h1>参議院</h1>

      </div>
      <div className="content-section">
        {isloading?<h1>Loading</h1>:meetingNameCards}

      </div>
    </div>
  );
}

export default SangiinMainPage;
