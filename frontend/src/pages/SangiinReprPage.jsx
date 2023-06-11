import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { sangiinEndpoint } from '../resource/resources';
import BasePageLayout from '../layouts/BasePageLayout';
import Accordion from '../components/basic/Accordion';

export default function SangiinReprPage() {
  //  eslint-disable-next-line no-unused-vars
  const [reps, setReps] = useState([]);
  //  eslint-disable-next-line no-unused-vars
  const [period, setPeriod] = useState('');
  const [kaihas, setKaihas] = useState([]);

  useEffect(() => {
    axios({
      method: 'get',
      url: `${sangiinEndpoint}repr`,
    }).then((res) => {
      console.log(res);
      setReps(res.data.reprs);
      setPeriod(res.data.meeting_period);
      setKaihas(Object.keys(res.data.reprs));
    });
  }, []);
  console.log('reps', reps);
  console.log('period', period);
  console.log('kaihas', kaihas);
  const kaihaAccordions = kaihas.map((kaiha) => {
    const kaihaReps = reps[kaiha];

    return <Accordion title={kaiha} content={kaihaReps} />;
  });
  return (
    <BasePageLayout
      backTo="/sangiin_menu"
      pageTitle="議員一覧"
      MainContent={kaihaAccordions}
    />
  );
}
