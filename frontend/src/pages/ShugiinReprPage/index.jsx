import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { shugiinEndpoint, SangiinAbbrev2Kaiha } from '../../resource/resources';
import BasePageLayout from '../../layouts/BasePageLayout';
import Accordion from '../../sharedComponents/basic/Accordion';
import ReprCard from '../../sharedComponents/ReprCard';
import { gridLoader } from '../../resource/loader';

/* eslint-disable react/no-unknown-property */
export default function ShugiinReprPage() {
  //  eslint-disable-next-line no-unused-vars
  const [reps, setReps] = useState(null);
  const [kaihas, setKaihas] = useState(null);

  useEffect(() => {
    axios({
      method: 'get',
      url: `${shugiinEndpoint}repr`,
    }).then((res) => {
      setReps(res.data.reprs);
      setKaihas(Object.keys(res.data.reprs));
    });
  }, []);
  const pageContent = !kaihas
    ? gridLoader
    : kaihas.map((oneKaiha) => {
        const kaihaReps = reps[oneKaiha];
        const numReps = kaihaReps.length;
        const kaihaRepsComponents = kaihaReps.map((rep) => {
          /* eslint-disable camelcase */
          const {
            name,
            yomikata,
            kaiha,
            district,
            period,
            number_of_terms_lower,
            number_of_terms_upper,
          } = rep;
          return (
            <ReprCard
              key={`${name}-${kaiha}`}
              name={name}
              yomikata={yomikata}
              kaiha={kaiha}
              district={district}
              period={period}
              numberOfTermsLower={number_of_terms_lower}
              numberofTermsUpper={number_of_terms_upper}
            />
          );
        });

        return (
          <Accordion
            key={oneKaiha}
            title={`${
              Object.keys(SangiinAbbrev2Kaiha).includes(oneKaiha)
                ? SangiinAbbrev2Kaiha[oneKaiha]
                : oneKaiha
            }（${numReps}）`}
            content={kaihaRepsComponents}
            extraStyles={{ title: '', content: 'card-container' }}
          />
        );
      });
  return (
    <BasePageLayout
      backTo="/shugiin_menu"
      pageTitle="議員一覧"
      MainContent={pageContent}
      extraStyles={{ content: 'flex flex-col items-center' }}
    />
  );
}
