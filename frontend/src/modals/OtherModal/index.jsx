import React from 'react';
import useModalState from 'modals/useModalState';
import { RxCross1 } from 'react-icons/rx';

export default function OtherModal() {
  const [modalsState, , removeModal] = useModalState();
  if (modalsState.indexOf('other') === -1) {
    return null;
  }
  return (
    <div>
      <button
        className="right-0 top-0 absolute transition hover:scale-125 mt-2 mr-2"
        onClick={() => removeModal('other')}
        type="button"
      >
        <RxCross1 className="h-10 w-10" />
      </button>
      <h1>Other Modal</h1>
    </div>
  );
}
