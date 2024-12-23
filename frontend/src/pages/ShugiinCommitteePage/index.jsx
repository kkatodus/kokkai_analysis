/* eslint-disable */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { shugiinEndpoint } from '../../resource/resources';
import BasePageLayout from '../../layouts/BasePageLayout';
import Accordion from '../../sharedComponents/basic/Accordion';
import ReprCard from '../../sharedComponents/ReprCard';
import { SangiinAbbrev2Kaiha } from '../../resource/resources';
import { gridLoader } from '../../resource/loader';

export default function ShugiinCommitteePage() {
  //  eslint-disable-next-line no-unused-vars
  const [coms, setComs] = useState(null);
  //  eslint-disable-next-line no-unused-vars
  const [period, setPeriod] = useState(null);
  const [comNames, setComNames] = useState(null);
  useEffect(() => {
    axios({
      method: 'get',
      url: `${shugiinEndpoint}commitee`,
    }).then((res) => {
      setComs(res.data.meetings);
      setComNames(Object.keys(res.data.meetings));
      setPeriod(res.data.meeting_period);
    });
    return () => {
      // Cleanup function to clear data
      setComs([]);
      setComNames([]);
      setPeriod([]);
    };
  }, []);
  const pageContent = !comNames
    ? gridLoader
    : comNames.map((comName) => {
        const comReps = coms[comName];
        const numReps = comReps.length;
        const comRepsComponents = comReps.map((rep) => {
          const { name, role, party, link } = rep;
          let partyName = party.replace(new RegExp('（|）', 'g'), '');
          partyName = SangiinAbbrev2Kaiha[partyName];
          return (
            <ReprCard
              key={`${name}-${party}-${role}`}
              name={name}
              role={role}
              party={partyName}
              link={link}
            />
          );
        });

        return (
          <Accordion
            key={comName}
            title={`${comName}（${numReps}）`}
            content={comRepsComponents}
            extraStyles={{ title: '', content: 'card-container' }}
          />
        );
      });

  return (
    <BasePageLayout
      backTo="/shugiin_menu"
      pageTitle="委員会一覧"
      MainContent={pageContent}
      extraStyles={{ content: 'flex flex-col items-center' }}
    />
  );
}
