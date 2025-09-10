import React from 'react';
import Proptypes from 'prop-types';
import ItemDisplay from './components/ItemDisplay';

const items = [
  { id: 's', price: 100, name: 'ちょっと応援する', color: 'bg-blue-200' },
  { id: 'm', price: 1000, name: 'もっと応援する', color: 'bg-blue-300' },
  { id: 'l', price: 10000, name: 'めっちゃ応援する', color: 'bg-blue-400' },
];

export default function PaymentPage({ setItems, makePayment, totalPrice }) {
  const totalPriceText = `合計金額: ${totalPrice}円`;
  return (
    <div className="w-full h-full flex flex-col justify-center items-center p-2">
      <div className="flex justify-center items-center flex-1">
        {items.map((item) => (
          <ItemDisplay key={item.id} setItems={setItems} item={item} />
        ))}
      </div>
      <div className="text-2xl text-bold p-2">{totalPriceText}</div>

      <button
        onClick={() => makePayment()}
        disabled={totalPrice === 0}
        className={` text-white p-2 rounded-lg whitespace-nowrap w-[60%] ${
          totalPrice === 0
            ? 'bg-slate-500'
            : 'bg-blue-500 hover:scale-110 transition-all duration-200 ease-in-out'
        }`}
        type="button"
      >
        支払い画面へ
      </button>
    </div>
  );
}

PaymentPage.propTypes = {
  setItems: Proptypes.func.isRequired,
  makePayment: Proptypes.func.isRequired,
  totalPrice: Proptypes.number.isRequired,
};
