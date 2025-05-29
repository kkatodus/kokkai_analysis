import React, { useState } from 'react';
import { RiArrowLeftLine, RiArrowRightLine } from 'react-icons/ri';   
import useModalState from 'modals/useModalState';
import { RxCross1 } from 'react-icons/rx';
import InitialPage from './components/InitialPage';
import HowToSelectTopic from './components/HowToSelectTopic';
import ReprSelectionPage from './components/ReprSelectionPage';
import TechnicalDisclaimer from './components/TechnicalDisclaimer';
import Difference2d1d from './components/Difference2d1d';
import ScreenSizeDisclaimer from './components/ScreenSizeDisclaimer';

const pageNames = [ 'initial', 'screenSizeDisclaimer', "technicalDisclaimer", 'howToSelectTopic', 'reprselection', 'difference2d1d']

const graphPages = {
	initial: InitialPage,
	howToSelectTopic: HowToSelectTopic,
	reprselection: ReprSelectionPage,
	technicalDisclaimer: TechnicalDisclaimer,
	difference2d1d: Difference2d1d,
	screenSizeDisclaimer: ScreenSizeDisclaimer,
}

export default function GraphInfoModal() {
	// eslint-disable-next-line no-unused-vars
	const {modalsState, removeModal} = useModalState();
	// eslint-disable-next-line no-unused-vars
	const [pageIndex, setPageIndex] = useState(0);
	

	const handlePageChange = (direction) => {
		if (direction === 'left') {
			setPageIndex(Math.max(0, pageIndex - 1));
		} else {
			setPageIndex(Math.min(pageNames.length - 1, pageIndex + 1));
		}
	}


	return (
		<div className="h-full w-full flex flex-col justify-center items-center">
		<button
		  className="right-0 top-0 absolute transition hover:scale-125 mt-2 mr-2"
		  onClick={() => removeModal('graphInfo')}
		  type="button"
		>
		  <RxCross1 className="h-10 w-10" />
		</button>
		<div className="flex-1 min-h-0 w-full flex flex-col justify-center items-center">
			{graphPages[pageNames[pageIndex]]()}
		</div>
		<div className="flex justify-between w-full">
			<button type="button" onClick={() => handlePageChange('left')} disabled={pageIndex === 0} className={`transition hover:scale-125 hover:text-white ${pageIndex === 0 ? 'opacity-50 hover:scale-100 hover:text-black' : ''}`}>
				<RiArrowLeftLine className="h-10 w-10" />
			</button>
			<button type="button" onClick={() => handlePageChange('right')} disabled={pageIndex === pageNames.length - 1} className={`transition hover:scale-125 hover:text-white ${pageIndex === pageNames.length - 1 ? 'opacity-50 hover:scale-100 hover:text-black' : ''}`}>
				<RiArrowRightLine className="h-10 w-10" />
			</button>
		</div>



		
	  </div>
	)
}