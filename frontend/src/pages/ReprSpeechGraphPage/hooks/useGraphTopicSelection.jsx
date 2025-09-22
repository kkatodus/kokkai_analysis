import { atom, useAtom } from 'jotai';
import axios from 'axios';
import { useEffect, useLayoutEffect, useState } from 'react';
import { staticEndpoint } from 'resource/resources';

const topicAtom = atom('nuclear');
const axisAtom = atom('restart');
const availableTopicsAtom = atom({});
const currentAxisAvailabilityAtom = atom([]);

const useGraphTopicSelection = () => {
  const [currentTopic, setTopicAtom] = useAtom(topicAtom);
  const [currentAxis, setAxisAtom] = useAtom(axisAtom);
  const [currentCon, setCurrentCon] = useState(null);
  const [currentPro, setCurrentPro] = useState(null);
  const [showSpectrum, setShowSpectrum] = useState(false);
  const [currentAxisAvailability, setCurrentAxisAvailability] = useAtom(
    currentAxisAvailabilityAtom
  );

  const [availableTopics, setAvailableTopics] = useAtom(availableTopicsAtom);
  useLayoutEffect(() => {
    axios.get(staticEndpoint).then((res) => {
      setAvailableTopics(res.data);
      setTopicAtom(res.data.availability[0].name);
      setAxisAtom(res.data.availability[0].data[0].name);
    });
  }, []);

  useEffect(() => {
    if (availableTopics.availability) {
      const topicData = availableTopics.availability.find(
        (topic) => topic.name === currentTopic
      );
      setCurrentAxisAvailability(topicData?.data);
      if (topicData?.data?.find((t) => t.name === currentAxis)) {
        setAxisAtom(currentAxis);
      } else {
        setAxisAtom(topicData?.data?.[0]?.name);
      }
    }
  }, [currentTopic]);

  useEffect(() => {
    setCurrentCon(
      availableTopics.availability
        ?.find((t) => t.name === currentTopic)
        ?.data?.find((d) => d.name === currentAxis)?.axis?.con
    );
    setCurrentPro(
      availableTopics.availability
        ?.find((t) => t.name === currentTopic)
        ?.data?.find((d) => d.name === currentAxis)?.axis?.pro
    );
    setShowSpectrum(
      availableTopics.availability
        ?.find((t) => t.name === currentTopic)
        ?.data?.find((d) => d.name === currentAxis)?.showSpectrum
    );
  }, [currentTopic, currentAxis]);

  const setCurrentTopic = (topic) => {
    setTopicAtom(topic);
    setAxisAtom(
      availableTopics.availability.find((t) => t.name === topic).data[0].name
    );
  };

  const setCurrentAxis = (axis) => {
    setAxisAtom(axis);
  };

  return {
    currentTopic,
    currentAxis,
    setCurrentTopic,
    setCurrentAxis,
    availableTopics,
    currentAxisAvailability,
    setCurrentAxisAvailability,
    currentCon,
    currentPro,
    showSpectrum,
  };
};

export default useGraphTopicSelection;
