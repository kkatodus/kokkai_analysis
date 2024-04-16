import React, { useEffect, useState } from 'react';
import axios from 'axios';
import BasePageLayout from '../../layouts/BasePageLayout';
import ReprCard from '../../sharedComponents/ReprCard';
import { SpeechAbbrev2Kaiha, speechEndpoint } from '../../resource/resources';
import { gridLoader } from '../../resource/loader';

function ReprOpinionMenuPage() {
  // eslint-disable-next-line no-unused-vars
  const [summary, setSummary] = useState([]);
  useEffect(() => {
    axios({
      method: 'get',
      url: `${speechEndpoint}`,
    }).then((res) => {
      setSummary(res.data.reprs);
    });
  }, []);

  const pageContent =
    summary.length === 0
      ? gridLoader
      : summary.map((repr) => (
          <ReprCard
            key={repr.id}
            name={repr.name}
            yomikata={repr.hiragana}
            tags={repr.tags}
            party={SpeechAbbrev2Kaiha[repr.party]}
            house={repr.house}
            link={`${repr.party}/${repr.name}`}
          />
        ));

  const extraStyles = !summary
    ? { content: '' }
    : { content: 'card-container justify-items-center' };
  return (
    <BasePageLayout
      pageTitle="議員分析"
      backTo="/repr_analysis"
      MainContent={pageContent}
      extraStyles={extraStyles}
    />
  );
}

export default ReprOpinionMenuPage;
