import React from 'react';
import Div100vh from 'react-div-100vh';
import { FaHome } from 'react-icons/fa';
import { Link } from 'react-router-dom';

export default function PaymentFailurePage() {
  return (
    <Div100vh>
      <div className="flex flex-col h-[99%] relative justify-center items-center">
        <h1 className="text-4xl font-bold mb-10">お支払いが失敗しました。</h1>
        <h2>KOKKAIDOCの活動をご支援いただきありがとうございます。</h2>
        <h2>
          何かしらの理由でお支払いを実行できませんでした。また次回、ご支援ください。
        </h2>
        <Link
          to="/"
          className="flex justify-center items-center text-bold mt-10 hover:text-white transition-colors duration-300 ease-in-out
		text-5xl"
        >
          <FaHome />
        </Link>
      </div>
    </Div100vh>
  );
}
