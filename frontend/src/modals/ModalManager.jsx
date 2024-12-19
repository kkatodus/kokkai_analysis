import React from 'react';
import { colors } from 'resource/styling';
import useDisplaySize from 'state/useDisplayType';
import useModalState from './useModalState';
import PaymentModal from './PaymentModal';
import OtherModal from './OtherModal';

export default function ModalManager() {
  // eslint-disable-next-line no-unused-vars
  const [modalsState, addModal, removeModal] = useModalState();
  const currentModal = modalsState[0];

  const key2Modal = {
    payment: <PaymentModal />,
    other: <OtherModal />,
  };
  const { type: displayType } = useDisplaySize();
  const modalWidth = displayType === 'mobile' ? 'w-full' : 'w-1/2';
  const modalHeight = displayType === 'mobile' ? 'h-1/2' : 'h-1/2';

  if (modalsState.length === 0) {
    return null;
  }

  return (
    <div
      className={`h-full w-full z-40 absolute bg-opacity-70 flex justify-center items-center ${colors.primary}`}
    >
      <div
        className={`relative ${modalHeight} ${modalWidth} ${colors.secondary} rounded-lg drop-shadow-2xl`}
      >
        {key2Modal[currentModal]}
      </div>
    </div>
  );
}
