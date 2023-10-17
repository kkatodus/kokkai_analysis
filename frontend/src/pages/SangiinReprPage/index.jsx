import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { sangiinEndpoint, SangiinAbbrev2Kaiha } from '../../resource/resources';
import BasePageLayout from '../../layouts/BasePageLayout';
import Accordion from '../../sharedComponents/basic/Accordion';
import ReprCard from '../../sharedComponents/ReprCard';
import { gridLoader } from '../../resource/loader';

/* eslint-disable react/no-unknown-property */
export default function SangiinReprPage() {
  //  eslint-disable-next-line no-unused-vars
  const [reps, setReps] = useState(null);
  //  eslint-disable-next-line no-unused-vars
  const [meetingPeriod, setPeriod] = useState(null);
  const [kaihas, setKaihas] = useState(null);

  useEffect(() => {
    axios({
      method: 'get',
      url: `${sangiinEndpoint}repr`,
    }).then((res) => {
      setReps(res.data.reprs);
      setPeriod(res.data.meeting_period);
      setKaihas(Object.keys(res.data.reprs));
    });
  }, []);
  const pageContent = !kaihas
    ? gridLoader
    : kaihas.map((oneKaiha) => {
        const kaihaReps = reps[oneKaiha];
        const numReps = kaihaReps.length;
        const kaihaRepsComponents = kaihaReps.map((rep) => {
          const { name, yomikata, kaiha, district, period } = rep;
          return (
            <ReprCard
              key={`${name}-${kaiha}`}
              name={name}
              yomikata={yomikata}
              kaiha={kaiha}
              district={district}
              period={period}
            />
          );
        });

        return (
          <Accordion
            key={oneKaiha}
            title={`${SangiinAbbrev2Kaiha[oneKaiha]}（${numReps}）`}
            content={kaihaRepsComponents}
            extraStyles={{ title: '', content: 'card-container' }}
          />
        );
      });
  return (
    <BasePageLayout
      backTo="/sangiin_menu"
      pageTitle="議員一覧"
      MainContent={pageContent}
      extraStyles={{ content: 'flex flex-col items-center' }}
    />
  );
}
