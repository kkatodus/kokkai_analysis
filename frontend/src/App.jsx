import { Routes, Route } from 'react-router-dom';
import './App.css';
import React from 'react';
import LandingPage from './pages/LandingPage';
// import SangiinMeetingsPage from './pages/SangiinMeetingsPage';
// import SangiinMeetingDetailPage from './pages/MeetingDetailPage';
// import SangiinTopicDetailPage from './pages/SangiinTopicDetailPage';
import InfoPage from './pages/InfoPage';
import SangiinMenuPage from './pages/SangiinMenuPage';
// import SangiinReprPage from './pages/SangiinReprPage';
// import SangiinCommitteePage from './pages/SangiinCommitteePage';
// import ShugiinMenuPage from './pages/ShugiinMenuPage';
// import ShugiinCommitteePage from './pages/ShugiinCommitteePage';
// import ShugiinReprPage from './pages/ShugiinReprPage';
/**
 *
 * @return {JSX.Element}
 */
function App() {
  return (
    <Routes>
      <Route exact path="/" element={<LandingPage />} />
      <Route exact path="/page_info" element={<InfoPage />} />
      <Route exact path="sangiin_menu" element={<SangiinMenuPage />} />
      {/* <Route exact path="sangiin_meetings" element={<SangiinMeetingsPage />} />
      <Route exact path="sangiin_repr" element={<SangiinReprPage />} />
      <Route
        exact
        path="sangiin_committee"
        element={<SangiinCommitteePage />}
      />
      <Route
        exact
        path="sangiin_meetings/:meetingId"
        element={<SangiinMeetingDetailPage />}
      />
      <Route
        exact
        path="sangiin_topic_details/:meetingId/:topicId"
        element={<SangiinTopicDetailPage />}
      />
      <Route exact path="shugiin_menu" element={<ShugiinMenuPage />} />
      <Route exact path="shugiin_repr" element={<ShugiinReprPage />} />
      <Route exact path="shugiin_commitee" element={<ShugiinCommitteePage />} /> */}
    </Routes>
  );
}

export default App;
