import { atom, useAtom } from 'jotai';

const modalsAtom = atom(['payment']);

const useModalState = () => {
  const [modalsState, setModalState] = useAtom(modalsAtom);

  const addModal = (modalKey) => {
    setModalState([...modalsState, modalKey]);
  };

  const removeModal = (modalKey) => {
    setModalState(modalsState.filter((key) => key !== modalKey));
  };

  return [modalsState, addModal, removeModal];
};

export default useModalState;
