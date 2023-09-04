import React, { useEffect, useState } from 'react';
import axios from 'axios';
import BasePageLayout from '../layouts/BasePageLayout';
import ReprCard from '../components/ReprCard';
import { sangiinEndpoint } from '../resource/resources';

function ReprOpinionMenuPage() {
  // eslint-disable-next-line no-unused-vars
  const [reprs, setReprs] = useState([]);
  useEffect(() => {
    axios({
      method: 'get',
      url: `${sangiinEndpoint}commitee`,
    }).then((res) => {
      setReprs(res.data);
    });
  }, []);
  const placeholder = [
    {
      name: '山田太郎',
      party: '自民党',
      tags: ['安全保障', '外交', '経済'],
    },
    {
      name: '山田太郎',
      party: '自民党',
      tags: ['安全保障', '外交', '経済'],
    },
    {
      name: '山田太郎',
      party: '自民党',
      tags: ['安全保障', '外交', '経済'],
    },
    {
      name: '山田太郎',
      party: '自民党',
      tags: ['安全保障', '外交', '経済'],
    },
    {
      name: '山田太郎',
      party: '自民党',
      tags: ['安全保障', '外交', '経済'],
    },
    {
      name: '山田太郎',
      party: '自民党',
      tags: ['安全保障', '外交', '経済'],
    },
    {
      name: '山田太郎',
      party: '自民党',
      tags: ['安全保障', '外交', '経済'],
    },
    {
      name: '山田太郎',
      party: '自民党',
      tags: ['安全保障', '外交', '経済'],
    },
    {
      name: '山田太郎',
      party: '自民党',
      tags: ['安全保障', '外交', '経済'],
    },
    {
      name: '山田太郎',
      party: '自民党',
      tags: ['安全保障', '外交', '経済'],
    },
  ];
  const pageContent = placeholder.map((repr) => (
    <ReprCard
      name={repr.name}
      party={repr.party}
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
