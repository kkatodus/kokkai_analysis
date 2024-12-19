import React from 'react';
import Proptypes from 'prop-types';
import { BiDonateHeart } from 'react-icons/bi';
import donationMessage from '../resource';

export default function DonationPage({ setModalPage }) {
  return (
    <div className="w-full h-full flex flex-col justify-center items-center">
      <div className="m-3">{donationMessage}</div>
      <button
        type="button"
        className="flex justify-center items-center text-4xl text-bold"
        onClick={() => setModalPage('payment')}
      >
        <BiDonateHeart />
        <div>募金する</div>
      </button>
    </div>
  );
}

DonationPage.propTypes = {
  setModalPage: Proptypes.func.isRequired,
};
