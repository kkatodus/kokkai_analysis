import React, { useEffect, useState } from 'react';
import axios from 'axios';
import BasePageLayout from '../../layouts/BasePageLayout';
import ReprCard from '../../sharedComponents/ReprCard';
import { SpeechAbbrev2Kaiha, speechEndpoint } from '../../resource/resources';
import { gridLoader } from '../../resource/loader';
import ReprSearchInput from '../../sharedComponents/ReprSearchInput';

function ReprOpinionMenuPage() {
  // eslint-disable-next-line no-unused-vars
  const [summary, setSummary] = useState([]);
  const [availableReprs, setAvailableReprs] = useState([]);
  const [currentRepr, setCurrentRepr] = useState(null);

  useEffect(() => {
    axios({
      method: 'get',
      url: `${speechEndpoint}`,
    }).then((res) => {
      setSummary(res.data.reprs);
      setAvailableReprs(res.data.reprs.map((repr) => `${repr.name}-${repr.party}`));
    });
  }, []);

  const pageContent =
    summary.length === 0
      ? gridLoader
      : summary.map((repr) => {
		const key = `${repr.name}-${repr.party}`;
		const currentReprName = currentRepr ? currentRepr.split('-')[0] : null;

		if (currentReprName && repr.name !== currentReprName) {
			return null;
		}

		return (
          <ReprCard
            key={key}
            name={repr.name}
            yomikata={repr.hiragana}
            tags={repr.tags}
            party={SpeechAbbrev2Kaiha[repr.party]}
            house={repr.house}
            link={`${repr.party}/${repr.name}`}
          />
		);
});
  return (
    <BasePageLayout
      pageTitle="議員分析"
      backTo="/repr_analysis"
	  headerComponent={
	  <div className='flex flex-col h-full items-start justify-center ml-2'>
		<ReprSearchInput availableReprs={availableReprs} setCurrentRepr={setCurrentRepr} setCurrentParty={()=>{}} setCurrentHouse={()=>{}} /></div>}
      MainContent={<div className='w-full h-full flex flex-wrap justify-center'>
		{pageContent}
	  </div>}
    />
  );
}

export default ReprOpinionMenuPage;
