import { atom, useAtom } from 'jotai';
import axios from 'axios';
import { useEffect, useLayoutEffect } from 'react';
import { staticEndpoint } from 'resource/resources';

const topicAtom = atom('defence');
const axisAtom = atom('constitution');
const availableTopicsAtom = atom({})
const currentAxisAvailabilityAtom = atom([])

const useGraphTopicSelection = () => {
  const [currentTopic, setTopicAtom] = useAtom(topicAtom);
  const [currentAxis, setAxisAtom] = useAtom(axisAtom);
  const [currentAxisAvailability, setCurrentAxisAvailability] = useAtom(currentAxisAvailabilityAtom);

  const [availableTopics, setAvailableTopics] = useAtom(availableTopicsAtom);
  useLayoutEffect(() => {
	axios.get(staticEndpoint).then((res) => {
      setAvailableTopics(res.data);
    });
  },[])

  useEffect(()=>{
	if(availableTopics.availability){
		const topicData = availableTopics.availability.find((topic) => topic.name === currentTopic)
		setCurrentAxisAvailability(topicData.data)
		setAxisAtom(topicData.data[0].name)
	}
  }, [currentTopic])

  const setCurrentTopic = (topic) => {
    setTopicAtom(topic);
	setAxisAtom(availableTopics.availability.find((t) => t.name === topic).data[0].name)
  };

  const setCurrentAxis = (axis) => {
    setAxisAtom(axis);
  };

  return {currentTopic, currentAxis, setCurrentTopic, setCurrentAxis, availableTopics, currentAxisAvailability, setCurrentAxisAvailability};
};

export default useGraphTopicSelection;
