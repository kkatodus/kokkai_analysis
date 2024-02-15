import { atom, useAtom } from 'jotai';
import { useEffect } from 'react';

const DisplayDimension = atom({
  height: window.innerHeight,
  weight: window.innerWidth,
  type: window.innerWidth > 768 ? 'desktop' : 'mobile',
});

export default function useDisplaySize() {
  const [displayTypeState, setDisplayType] = useAtom(DisplayDimension);

  const updateDisplayTypeState = (displayType) => {
    setDisplayType(displayType);
  };
  useEffect(() => {
    const handleResize = () => {
      updateDisplayTypeState({
        width: window.innerWidth,
        height: window.innerHeight,
        type: window.innerWidth > 768 ? 'desktop' : 'mobile',
      });
    };

    window.addEventListener('resize', handleResize);
    // Clean up the event listener when the component unmounts
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  return displayTypeState;
}
