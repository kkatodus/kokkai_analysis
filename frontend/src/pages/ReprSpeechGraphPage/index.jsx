import React, { useEffect, useState } from 'react';
import axios from 'axios';
import BasePageLayout from '../../layouts/BasePageLayout';
import ScatterWithLineGraph from './components/ScatterWithLineGraph/ScatterWithLineGraph';
import SpeechPanel from './components/SpeechPanel/SpeechPanel';
import TopicSelector from './components/TopicSelector';
import { visualEndpoint } from '../../resource/resources';
import disclaimer from './disclaimer';
import { gridLoader } from '../../resource/loader';
import DimensionToggle from './components/DimensionToggle';

const possibleTopics = ['防衛', 'LGBTQ', '原発', '少子化', '気候変動'];
function ReprSpeechGraphPage() {
  const [currentTopic, setCurrentTopic] = useState('防衛');
  const [currentRepr, setCurrentRepr] = useState(null);
  const [currentParty, setCurrentParty] = useState(null);
  const [Scatter2dData, setScatter2dData] = useState(null);
  const [Scatter1dData, setScatter1dData] = useState(null);
  const [lineData, setLineData] = useState(null);
  const [dimension, setDimension] = useState('2D');
  const displayScatterData = dimension === '1D' ? Scatter1dData : Scatter2dData;
  useEffect(() => {
    setCurrentRepr(null);
    const requestUrl = `${visualEndpoint}/${currentTopic}`;
    axios({
      method: 'get',
      url: requestUrl,
    })
      .then((res) => {
        setScatter2dData(res.data['2d'].data);
        setScatter1dData(res.data['1d'].data);
        setLineData(
          res.data['2d'].data.filter(
            (d) => d.ref_point === 'for' || d.ref_point === 'against'
          )
        );
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.log(err);
      });
  }, [currentTopic]);

  const pageContent = !Scatter2dData ? (
    gridLoader
  ) : (
    <div className="w-full h-full">
      <div className="flex h-[90%]">
        <div className="w-[70%] h-full">
          <ScatterWithLineGraph
            displayLine={dimension === '2D'}
            scatterData={displayScatterData}
            lineData={lineData}
            setCurrentParty={setCurrentParty}
            setCurrentRepr={setCurrentRepr}
          />
        </div>
        <div className="w-[30%]">
          <SpeechPanel
            currentHouse="lower"
            currentParty={currentParty}
            currentRepr={currentRepr}
            currentTopic={currentTopic}
          />
        </div>
      </div>
      <div className="h-[10%] overflow-y-scroll">
        <div className="w-full h-full">{disclaimer}</div>
      </div>
    </div>
  );
  return (
    <BasePageLayout
      pageTitle="スタンスの可視化"
      backTo="/repr_analysis"
      headerComponent={
        <div className="flex h-full">
          <TopicSelector
            topics={possibleTopics}
            setSelectedTopic={setCurrentTopic}
            selectedTopic={currentTopic}
          />
          <DimensionToggle
            setSelectedDimension={setDimension}
            selectedDimension={dimension}
          />
        </div>
      }
      MainContent={pageContent}
      extraStyles={{ content: 'flex flex-wrap' }}
    />
  );
}

export default ReprSpeechGraphPage;
