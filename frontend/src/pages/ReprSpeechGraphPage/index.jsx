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
import LeftRightSpectrum from './components/LeftRightSpectrum';
import useDisplaySize from '../../state/useDisplayType';

const possibleTopics = ['防衛', '原発', '少子化', '気候変動'];
function ReprSpeechGraphPage() {
  const [currentTopic, setCurrentTopic] = useState('防衛');
  const [currentRepr, setCurrentRepr] = useState(null);
  const [currentParty, setCurrentParty] = useState(null);
  const [Scatter2dData, setScatter2dData] = useState(null);
  const [Scatter1dData, setScatter1dData] = useState(null);
  const [lineData, setLineData] = useState(null);
  const [dimension, setDimension] = useState('1D');
  const [leftLabel, setLeftLabel] = useState(null);
  const [rightLabel, setRightLabel] = useState(null);
  const displayScatterData = dimension === '1D' ? Scatter1dData : Scatter2dData;
  const { type } = useDisplaySize();
  const isMobile = type === 'mobile';
  useEffect(() => {
    setCurrentRepr(null);
    const requestUrl = `${visualEndpoint}/${currentTopic}`;
    axios({
      method: 'get',
      url: requestUrl,
    })
      .then((res) => {
        setLeftLabel(res.data['1d'].descriptions?.left);
        setRightLabel(res.data['1d'].descriptions?.right);
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
    <div
      className={`w-full ${isMobile ? 'overflow-y-scroll h-auto' : 'h-full'}`}
    >
      <div className={`${isMobile ? 'h-auto' : 'flex'} h-[90%] relative`}>
        <div className={`${isMobile ? '' : 'w-[70%]'} relative`}>
          {dimension === '1D' && leftLabel && rightLabel && (
            <div className="h-[5%]">
              <LeftRightSpectrum
                leftLabel={leftLabel}
                rightLabel={rightLabel}
              />
            </div>
          )}
          <div className={`${isMobile ? 'h-[800px]' : 'h-[95%]'}`}>
            <ScatterWithLineGraph
              displayLine={dimension === '2D'}
              scatterData={displayScatterData}
              lineData={lineData}
              setCurrentParty={setCurrentParty}
              setCurrentRepr={setCurrentRepr}
            />
          </div>
        </div>
        <div className={`${isMobile ? 'w-full h-[500px]' : 'w-[30%]'}`}>
          <SpeechPanel
            currentHouse="lower"
            currentParty={currentParty}
            currentRepr={currentRepr}
            currentTopic={currentTopic}
          />
        </div>
      </div>
      <div
        className={`${
          isMobile ? 'h-auto' : 'h-[10%] '
        } w-full p-2 overflow-y-scroll text-sm`}
      >
        {disclaimer}
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
