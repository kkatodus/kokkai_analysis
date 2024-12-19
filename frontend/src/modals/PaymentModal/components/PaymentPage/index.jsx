import React from 'react';
import Proptypes from 'prop-types';
import ItemDisplay from './components/ItemDisplay';

const items = [
  { id: 's', price: 100, name: 'ちょっと応援する', color: 'bg-red-200' },
  { id: 'm', price: 1000, name: 'もっと応援する', color: 'bg-red-300' },
  { id: 'l', price: 10000, name: 'めっちゃ応援する', color: 'bg-red-400' },
];

export default function PaymentPage({ setItems, makePayment }) {
  return (
    <div className="w-full h-full flex flex-col justify-center items-center">
      <div className="flex justify-center items-center">
        {items.map((item) => (
          <ItemDisplay key={item.id} setItems={setItems} item={item} />
        ))}
      </div>

      <button
        onClick={() => makePayment()}
        className="bg-blue-500 text-white p-2 rounded-lg"
        type="button"
      >
        支払う
      </button>
    </div>
  );
}

PaymentPage.propTypes = {
  setItems: Proptypes.func.isRequired,
  makePayment: Proptypes.func.isRequired,
};
