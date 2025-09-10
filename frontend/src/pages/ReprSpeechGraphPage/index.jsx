import React, { useEffect, useLayoutEffect, useState } from 'react';
import axios from 'axios';
import useDisplaySize from 'state/useDisplayType';
import useModalState from 'modals/useModalState';
import {RiInformationLine} from 'react-icons/ri';
import { gridLoader } from 'resource/loader';
import BasePageLayout from 'layouts/BasePageLayout';
import { staticEndpoint, Topic2Topic, House2House} from 'resource/resources';
import { useWebView } from 'contexts/WebViewContext';
import ReprSearchInput from 'sharedComponents/ReprSearchInput';
import ScatterWithLineGraph from './components/ScatterWithLineGraph/ScatterWithLineGraph';
import SpeechPanel from './components/SpeechPanel/SpeechPanel';
import DimensionToggle from './components/DimensionToggle';
import LeftRightSpectrum from './components/LeftRightSpectrum';
import useGraphTopicSelection from './hooks/useGraphTopicSelection';
import TopicSelectionModalOpener from './components/TopicSelectionModalOpener';

function ReprSpeechGraphPage() {
  const {currentTopic, currentAxis, currentAxisAvailability, currentCon, currentPro, showSpectrum} = useGraphTopicSelection();
  const {addModal} = useModalState();
  const { isWebView } = useWebView();
  const [currentRepr, setCurrentRepr] = useState(null);
  const [currentParty, setCurrentParty] = useState(null);
  const [currentHouse, setCurrentHouse] = useState(null);
  const [Scatter2dData, setScatter2dData] = useState(null);
  const [availableReprs, setAvailableReprs] = useState(null);
  const [Scatter1dData, setScatter1dData] = useState(null);
  const [lineData, setLineData] = useState(null);
  const [dimension, setDimension] = useState('1D');
  
  const displayScatterData = dimension === '1D' ? Scatter1dData : Scatter2dData;

  useLayoutEffect(() => {
    // Don't show info modal in webview
    if (!isWebView) {
      addModal('graphInfo');
    }
  }, [isWebView]);
  
  const { type } = useDisplaySize();
  const isMobile = type === 'mobile';
  useEffect(() => {
    setCurrentRepr(null);
    const requestUrl = `${staticEndpoint}/${currentTopic}/${currentAxis}`;
    axios({
      method: 'get',
      url: requestUrl,
    })
      .then((res) => {
        setScatter2dData(res.data['2d'].data);
        setScatter1dData(res.data['1d'].data);
        setAvailableReprs(res.data['1d'].data.map((d) => `${d.repr}-${d.party}-${House2House[d.house]}`));
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
  }, [currentTopic, currentAxis]);
  const pageContent = !Scatter2dData ? (
    gridLoader
  ) : (
    <div
      className={`w-full ${isMobile ? 'h-full' : 'h-full'}`}
    >
      <div className={`${isMobile ? 'flex flex-col h-full' : 'flex'} h-[100%] relative`}>
        <div className={`${isMobile ? 'w-full h-[50%]' : 'w-[70%]'} relative`}>
          {dimension === '1D' && showSpectrum && (
            <div className={` overflow-y-scroll ${isMobile ? 'h-[10%]' : 'h-[5%]'}`}>
            	<LeftRightSpectrum leftLabel={currentCon} rightLabel={currentPro} />
            </div>
          )}
          <div className={`${isMobile ? 'h-full' : 'h-[95%]'}`}>
            <ScatterWithLineGraph
              displayLine={dimension === '2D'}
              scatterData={displayScatterData}
              lineData={lineData}
              setCurrentParty={setCurrentParty}
              setCurrentRepr={setCurrentRepr}
              setCurrentHouse={setCurrentHouse}
			  currentRepr={currentRepr}
              showXAxis={false}
              showYAxis={false}
            />
          </div>
        </div>
        <div className={`${isMobile ? 'w-full flex-1 min-h-0' : 'w-[30%]'}`}>
          <SpeechPanel
            currentHouse={currentHouse}
            currentParty={currentParty}
            currentRepr={currentRepr}
            currentTopic={currentTopic}
          />
        </div>
      </div>
    </div>
  );
  return (
    <BasePageLayout
      pageTitle="スタンスの可視化"
      backTo="/repr_analysis"
      headerComponent={
        <div className="flex h-full">
            <button
              className="transition hover:scale-125 hover:text-white"
              onClick={() => addModal('graphInfo')}
              type="button"
            >
              <RiInformationLine className="h-10 w-10" />
            </button>
		  <div className={`flex items-center justify-center w-full flex-col ${isMobile ? 'hidden' : ''}`}>
			<h1 className="text-sm font-bold whitespace-nowrap">トピック:{Topic2Topic[currentTopic]}</h1>
			<h1 className="text-sm font-bold">対立軸:{currentAxisAvailability.find((axis) => axis.name === currentAxis)?.jpn}</h1>
		  </div>
		  <div className={`flex items-center justify-center w-full ${isMobile ? 'flex-row flex-1' : 'flex-col'}`}>
			{!isWebView && (
              <TopicSelectionModalOpener
                addModal={addModal}
              />
            )}
			<ReprSearchInput availableReprs={availableReprs} setCurrentRepr={setCurrentRepr} setCurrentParty={setCurrentParty} setCurrentHouse={setCurrentHouse}/>
		  </div>
          
          <DimensionToggle
            setSelectedDimension={setDimension}
            selectedDimension={dimension}
          />
        </div>
      }
	  showPageTitle={!isMobile}
      MainContent={pageContent}
      extraStyles={{ content: 'flex flex-wrap' }}
    />
  );
}

export default ReprSpeechGraphPage;
