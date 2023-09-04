import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import BasePageLayout from '../layouts/BasePageLayout';
import ReprTopicOpinionCard from '../components/ReprTopicOpinionCard';
import { speechEndpoint } from '../resource/resources';

function ReprOpinionPage() {
  const { reprId } = useParams();
  const [reprOpinions, setReprOpinions] = useState({});

  useEffect(() => {
    axios({
      method: 'get',
      url: `${speechEndpoint}/opinion/${reprId}`,
    })
      .then((res) => {
        setReprOpinions(res.data);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.log(err);
      });
  }, []);
  console.log('reprOpinions', reprOpinions);

  const pageContent = reprOpinions.opinions?.map((opinion) => {
    console.log('opinion', opinion);
    return <ReprTopicOpinionCard opinionsByTopic={opinion} />;
  });

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
