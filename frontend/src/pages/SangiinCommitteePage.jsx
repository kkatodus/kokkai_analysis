import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { sangiinEndpoint } from '../resource/resources';
import BasePageLayout from '../layouts/BasePageLayout';

export default function SangiinCommitteePage() {
  //  eslint-disable-next-line no-unused-vars
  const [coms, setComs] = useState([]);
  //  eslint-disable-next-line no-unused-vars
  const [period, setPeriod] = useState('');
  useEffect(() => {
    axios({
      method: 'get',
      url: `${sangiinEndpoint}commitee`,
    }).then((res) => {
      setComs(res.data.meetings);
      setPeriod(res.data.meeting_period);
      console.log(res);
      console.log(coms);
      console.log(period);
    });
  }, []);

  return (
    <BasePageLayout
      backTo="/sangiin_menu"
      pageTitle="委員会一覧"
      MainContent={<h1>placeholder</h1>}
    />
  );
}
