import React, { useEffect, useState } from 'react';
import axios from 'axios';
import BasePageLayout from '../layouts/BasePageLayout';
import ReprCard from '../components/ReprCard';
import { speechEndpoint, SpeechAbbrev2Kaiha } from '../resource/resources';

function ReprOpinionMenuPage() {
  // eslint-disable-next-line no-unused-vars
  const [reprs, setReprs] = useState([]);
  useEffect(() => {
    axios({
      method: 'get',
      url: `${speechEndpoint}`,
    }).then((res) => {
      setReprs(res.data.reprs);
    });
  }, []);

  const pageContent = reprs.map((repr) => (
    <ReprCard
      name={repr.name}
      party={SpeechAbbrev2Kaiha[repr.party]}
      tags={repr.tags}
      link={`${repr.party}/${repr.name}`}
    />
  ));
  return (
    <BasePageLayout
      pageTitle="議員分析"
      backTo="/"
      MainContent={pageContent}
      extraStyles={{
        content: 'card-container justify-items-center',
      }}
    />
  );
}

export default ReprOpinionMenuPage;
