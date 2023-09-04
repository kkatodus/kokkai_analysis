import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import BasePageLayout from '../layouts/BasePageLayout';
import ReprTopicOpinionCard from '../components/ReprTopicOpinionCard';
import { speechEndpoint } from '../resource/resources';

function ReprOpinionPage() {
  const { reprId, party } = useParams();
  const [reprSummary, setReprSummary] = useState(undefined);
  console.log(reprSummary);
  useEffect(() => {
    axios({
      method: 'get',
      url: `${speechEndpoint}/${party}/${reprId}`,
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
      party={party}
      reprName={reprId}
      idxOptions={reprSummary.number_of_files[tag]}
      topic={tag}
    />
  ));

  return (
    <BasePageLayout
      pageTitle={reprId}
      backTo="/repr_analysis"
      MainContent={pageContent}
      extraStyles={{ content: 'flex flex-wrap' }}
    />
  );
}

export default ReprOpinionPage;
