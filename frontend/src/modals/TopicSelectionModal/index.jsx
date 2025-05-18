import React from 'react';
import useGraphTopicSelection from 'pages/ReprSpeechGraphPage/hooks/useGraphTopicSelection';
import useModalState from 'modals/useModalState';
import { RxCross1 } from 'react-icons/rx';
import { colors } from 'resource/styling';

export default function TopicSelectionModal() {
	const { availableTopics,currentTopic,currentAxis, setCurrentTopic, setCurrentAxis, currentAxisAvailability} = useGraphTopicSelection()
	const {removeModal} = useModalState()


	return (
	
		<div className="items-center justify-center w-full h-full flex flex-col">
			<button onClick={() => removeModal('topicSelection')} type="button" className="absolute top-0 left-0 hover:scale-125 transition">
				<RxCross1 className="h-10 w-10" />
			</button>
			<h1 className="text-2xl font-bold w-full text-start pl-2">トピックを選んでください</h1>

			<div className="flex flex-row flex-wrap items-center w-full justify-start">
				{availableTopics?.availability?.map((topic) => (
					<button key={topic.name} type="button" onClick={() => setCurrentTopic(topic.name)} className={`${currentTopic === topic.name ? colors.primary : colors.tertiary} m-2 p-2 rounded-md hover:scale-110 transition`}>
						{topic.jpn}
					</button>
				))
				}
			</div>
			<h1 className="text-2xl font-bold w-full text-start pl-2">対立軸を選んでください</h1>
			<div className="flex flex-row items-center justify-start w-full">
				{currentAxisAvailability?.map((axis) => (
					<button key={axis.name} type="button" onClick={() => setCurrentAxis(axis.name)} className={`${currentAxis === axis.name ? colors.primary : colors.tertiary} m-2 p-2 rounded-md hover:scale-110 transition`}>
						{axis.jpn}
					</button>
				))}
			</div>
		</div>
	);
}
		