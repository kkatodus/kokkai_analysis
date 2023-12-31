import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import BasePageLayout from '../../layouts/BasePageLayout';
import ReprTopicOpinionCard from './components/ReprTopicOpinionCard';
import { speechEndpoint } from '../../resource/resources';

function ReprOpinionPage() {
  const { house, reprId, party } = useParams();
  const [reprSummary, setReprSummary] = useState(undefined);
  useEffect(() => {
    axios({
      method: 'get',
      url: `${speechEndpoint}/${house}/${party}/${reprId}`,
    })
      .then((res) => {
        setReprSummary(res.data);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.log(err);
      });
  }, []);

  const pageContent = reprSummary?.tags.map((tag) => (
    <ReprTopicOpinionCard
      key={tag}
      house={house}
      party={party}
      reprName={reprId}
      topic={tag}
    />
  ));
  return (
    <BasePageLayout
      pageTitle={reprId}
      backTo={`/repr_analysis/speech/${house}`}
      MainContent={pageContent}
      extraStyles={{ content: 'flex flex-wrap' }}
    />
  );
}

export default ReprOpinionPage;
