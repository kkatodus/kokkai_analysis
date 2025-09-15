import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import './App.css';
import './styles/animations.css';
import './styles/general.css';
import './styles/sanitize.css';
import LandingPage from 'pages/LandingPage';
import SangiinMeetingsPage from 'pages/SangiinMeetingsPage';
import SangiinMeetingDetailPage from 'pages/SangiinMeetingDetailPage';
import InfoPage from 'pages/InfoPage';
import SangiinMenuPage from 'pages/SangiinMenuPage';
import SangiinReprPage from 'pages/SangiinReprPage';
import SangiinCommitteePage from 'pages/SangiinCommitteePage';
import ShugiinMenuPage from 'pages/ShugiinMenuPage';
import ShugiinCommitteePage from 'pages/ShugiinCommitteePage';
import ShugiinReprPage from 'pages/ShugiinReprPage';
import ReprOpinionPage from 'pages/ReprOpinionPage';

import PaymentSuccessPage from 'pages/PaymentResultPages/PaymentSuccessPage';
import PaymentFailurePage from 'pages/PaymentResultPages/PaymentFailurePage';
import PrivacyPolicyPage from 'pages/PrivacyPolicyPage';
import TermsAndConditionsPage from 'pages/TermsAndConditionsPage';
import { squareLoader } from 'resource/loader';

const ReprOpinionSummaryPage = lazy(() => import('pages/ReprOpinionSummaryPage'));
const ReprAnalysisMenuPage = lazy(() => import('pages/ReprAnalysisMenuPage'));
const ReprSpeechGraphPage = lazy(() => import('pages/ReprSpeechGraphPage'));
const StatsMenuPage = lazy(() => import('pages/StatsMenuPage'));
const PopulationPage = lazy(() => import('pages/StatPages/PopulationPage'));
const ReprSearchPage = lazy(() => import('pages/ReprSearchPage'));
const PartyManifestoPage = lazy(() => import('pages/PartyManifestoPage'));


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
    <Suspense fallback={squareLoader}>
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

      <Route exact path="repr_analysis" element={<ReprAnalysisMenuPage />} />
      <Route exact path="repr_analysis/speech" element={<ReprOpinionSummaryPage />}/>

      <Route
        exact
        path="repr_analysis/speech/:party/:reprId"
        element={<ReprOpinionPage />}
      />
      <Route
        exact
        path="repr_analysis/graph"
        element={<ReprSpeechGraphPage />}
      />
      <Route exact path="party_manifesto" element={<PartyManifestoPage />} />
      <Route exact path="repr_analysis/search" element={<ReprSearchPage />} />
      <Route exact path="stats" element={<StatsMenuPage />} />
      <Route exact path="stats/population" element={<PopulationPage />} />
      <Route exact path="payment-success" element={<PaymentSuccessPage />} />
      <Route exact path="payment-cancel" element={<PaymentFailurePage />} />
      <Route exact path="privacy-policy" element={<PrivacyPolicyPage />} />
      <Route exact path="terms-and-conditions" element={<TermsAndConditionsPage />} />
    </Routes>
        </Suspense>

  );
}

export default App;
