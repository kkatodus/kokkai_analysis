import React from 'react';
import Proptypes from 'prop-types';
import { BiDonateHeart } from 'react-icons/bi';

export default function DonationPage({ setModalPage }) {
  return (
    <div className="w-full h-full flex flex-col justify-center items-center">
    <div className="flex-1 m-3 overflow-y-scroll mt-10 items-center justify-center flex flex-col" >
		<p>KOKKAI DOC は、一人のエンジニアが運営するプロジェクトです。日本の政治と民主主義の質を高めることを目指し、国会データの可視化と公開に取り組んでおります。当サービスの理念にご賛同いただけましたら、ぜひご支援をご検討ください。</p>
		<p><span className="font-bold">4,000 円以上</span>のご寄付 を賜った場合、ご希望に応じて「このページについて」内のご支援者一覧にお名前（本名またはご指定のお名前）を掲載させていただきます。</p>
		<p className="font-bold">皆さまの温かいご協力が、より開かれた民主主義の実現につながります。何卒よろしくお願い申し上げます。</p>
	  </div>
      <button
        type="button"
        className="flex h-16 justify-center items-center text-4xl text-bold hover:scale-125 transition-all duration-200 ease-in-out"
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
