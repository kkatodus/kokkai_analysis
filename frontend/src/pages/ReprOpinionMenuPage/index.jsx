import React, { useEffect, useState } from 'react';
import axios from 'axios';
import BasePageLayout from '../../layouts/BasePageLayout';
import ReprCard from '../../sharedComponents/ReprCard';
import { SpeechAbbrev2Kaiha, speechEndpoint } from '../../resource/resources';
import { gridLoader } from '../../resource/loader';

function ReprOpinionMenuPage() {
  // eslint-disable-next-line no-unused-vars
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    axios({
      method: 'get',
      url: `${speechEndpoint}`,
    }).then((res) => {
      setSummary(res.data);
    });
  }, []);
  const parties = summary ? Object.keys(summary.reprs) : [];

  const pageContent = !summary
    ? gridLoader
    : parties.map((party) => {
        const partyDict = summary.reprs[party];
        const partyReprs = Object.keys(partyDict);
        const reprCards = partyReprs.map((repr) => (
          <ReprCard
            name={repr}
            party={SpeechAbbrev2Kaiha[party]}
            tags={partyDict[repr].tags}
            link={`${party}/${repr}`}
          />
        ));
        return reprCards;
      });
  const extraStyles = !summary
    ? { content: '' }
    : { content: 'card-container justify-items-center' };
  return (
    <BasePageLayout
      pageTitle="議員分析"
      backTo="/"
      MainContent={pageContent}
      extraStyles={extraStyles}
    />
  );
}

export default ReprOpinionMenuPage;
