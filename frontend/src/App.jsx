import React from 'react';
import { Routes, Route } from 'react-router-dom';
import './App.css';
import './styles/animations.css';
import './styles/general.css';
import './styles/sanitize.css';
import LandingPage from './pages/LandingPage';
import SangiinMeetingsPage from './pages/SangiinMeetingsPage';
import SangiinMeetingDetailPage from './pages/SangiinMeetingDetailPage';
import InfoPage from './pages/InfoPage';
import SangiinMenuPage from './pages/SangiinMenuPage';
import SangiinReprPage from './pages/SangiinReprPage';
import SangiinCommitteePage from './pages/SangiinCommitteePage';
import ShugiinMenuPage from './pages/ShugiinMenuPage';
import ShugiinCommitteePage from './pages/ShugiinCommitteePage';
import ShugiinReprPage from './pages/ShugiinReprPage';
import ReprOpinonMenuPage from './pages/ReprOpinionMenuPage';
import ReprOpinionPage from './pages/ReprOpinionPage';
import StatsMenuPage from './pages/StatsMenuPage';
import PopulationPage from './pages/StatPages/PopulationPage';
/**
 *
 * @return {JSX.Element}
 */
function App() {
  const appHeight = () => {
    const doc = document.documentElement;
    doc.style.setProperty('--app-height', `${window.innerHeight}px`);
  };
  window.addEventListener('resize', appHeight);
  appHeight();
  return (
    <Routes>
      <Route exact path="/" element={<LandingPage />} />
      <Route exact path="/page_info" element={<InfoPage />} />
      <Route exact path="sangiin_menu" element={<SangiinMenuPage />} />
      <Route exact path="sangiin_meetings" element={<SangiinMeetingsPage />} />
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
      <Route exact path="shugiin_menu" element={<ShugiinMenuPage />} />
      <Route exact path="shugiin_repr" element={<ShugiinReprPage />} />
      <Route exact path="shugiin_commitee" element={<ShugiinCommitteePage />} />
      <Route exact path="repr_analysis" element={<ReprOpinonMenuPage />} />
      <Route
        exact
        path="repr_analysis/:party/:reprId"
        element={<ReprOpinionPage />}
      />
      <Route exact path="stats" element={<StatsMenuPage />} />
      <Route exact path="stats/population" element={<PopulationPage />} />
    </Routes>
  );
}

export default App;
