import {Routes, Route} from 'react-router-dom';
import './App.css';
import React from 'react';
import LandingPage from './pages/LandingPage';
import SangiinMainPage from './pages/SangiinMainPage';
import MeetingDetailPage from './pages/MeetingDetailPage';
import TopicDetailPage from './pages/TopicDetailPage';
import InfoPage from './pages/InfoPage';
/**
 *
 * @return {JSX.Element}
 */
function App() {
  return (
    <Routes>
      <Route exact path="/" element={<LandingPage />} />
      <Route exact path="sangiin_main" element={<SangiinMainPage />} />
      <Route exact
        path="meeting_page/:meetingId"
        element={<MeetingDetailPage />} />
      <Route exact
        path="topic_details/:meeting_id/:topicId"
        element={<TopicDetailPage />} />
      <Route exact path="/page_info" element={<InfoPage />} />
    </Routes>

  );
}

export default App;
