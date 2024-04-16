import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import BasePageLayout from '../../layouts/BasePageLayout';
import ReprTopicOpinionCard from './components/ReprTopicOpinionCard';
import { speechEndpoint } from '../../resource/resources';

function ReprOpinionPage() {
  const { reprId, party } = useParams();
  const [reprSummary, setReprSummary] = useState(undefined);
  useEffect(() => {
    axios({
      method: 'get',
      url: `${speechEndpoint}summary/${party}/${reprId}`,
    })
      .then((res) => {
        setReprSummary(res.data);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.log(err);
      });
  }, []);

  const pageContent = reprSummary ? (
    reprSummary.tags.map((tag) => (
      <ReprTopicOpinionCard
        key={tag}
        party={party}
        reprName={reprId}
        topic={tag}
      />
    ))
  ) : (
    <div className="h-full w-full flex items-center justify-center">
      <h1 className="text-2xl font-extrabold">
        この議員の発言データはありません
      </h1>
    </div>
  );
  return (
    <BasePageLayout
      pageTitle={reprId}
      backTo="/repr_analysis/speech"
      MainContent={pageContent}
      extraStyles={{ content: 'flex flex-wrap' }}
    />
  );
}

export default ReprOpinionPage;
