import React from 'react';
import { useParams } from 'react-router-dom';
import BasePageLayout from '../layouts/BasePageLayout';
import ReprTopicOpinionCard from '../components/ReprTopicOpinionCard';

function ReprOpinionPage() {
  const { reprId, party } = useParams();

  console.log(reprId, party);

  const mockData = {
    opinions: [
      {
        topic: '安全保障',
        speeches: [
          {
            speechLink: '',
            opinions: ['sohlfjadkls', 'fjkdaskfjlkasd'],
            date: '2021-01-01',
          },
          {
            speechLink: '',
            opinions: ['sohlfjadkls', 'fjkdaskfjlkasd'],
            date: '2021-01-01',
          },
          {
            speechLink: '',
            opinions: ['sohlfjadkls', 'fjkdaskfjlkasd'],
            date: '2021-01-01',
          },
        ],
      },
      {
        topic: '安全保障',
        speeches: [
          {
            speechLink: '',
            opinions: ['sohlfjadkls', 'fjkdaskfjlkasd'],
            date: '2021-01-01',
          },
          {
            speechLink: '',
            opinions: ['sohlfjadkls', 'fjkdaskfjlkasd'],
            date: '2021-01-01',
          },
          {
            speechLink: '',
            opinions: ['sohlfjadkls', 'fjkdaskfjlkasd'],
            date: '2021-01-01',
          },
        ],
      },
      {
        topic: '安全保障',
        speeches: [
          {
            speechLink: '',
            opinions: ['sohlfjadkls', 'fjkdaskfjlkasd'],
            date: '2021-01-01',
          },
          {
            speechLink: '',
            opinions: ['sohlfjadkls', 'fjkdaskfjlkasd'],
            date: '2021-01-01',
          },
          {
            speechLink: '',
            opinions: ['sohlfjadkls', 'fjkdaskfjlkasd'],
            date: '2021-01-01',
          },
        ],
      },
    ],
  };

  const pageContent = mockData.opinions.map((opinion) => (
    <ReprTopicOpinionCard opinionsByTopic={opinion} />
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
