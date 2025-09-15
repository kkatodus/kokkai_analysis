import React from 'react';
import Proptypes from 'prop-types';
import ItemDisplay from './components/ItemDisplay';

const displayOrder = ['s', 'm', 'l'];

export default function PaymentPage({ items, setItems, makePayment, totalPrice, subscription, setSubscription }) {
  const totalPriceText = `${totalPrice}円`;
  return (
    <div className="w-full h-full flex flex-col justify-center items-center p-2">
		<button
			onClick={() => {setSubscription(!subscription)}}
			className={`text-blue-500 bg-blue-200 p-2 rounded-lg hover:scale-110 transition-all duration-200 ease-in-out ${subscription ? 'bg-blue-400' : 'bg-blue-200'}`} 
			type="button"
		>
			{subscription ? '一度応援する' : '長期的に応援する'}
		</button>
      <div className="flex justify-center items-center flex-1">
		{displayOrder.map((key) => (
        	<ItemDisplay key={key} setItems={setItems} item={items[key]} />
        ))}
      </div>
      <div className="text-2xl text-bold p-2">{subscription ? '月額：' : '合計金額：'} {totalPriceText}</div>

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
  items: Proptypes.objectOf(Proptypes.shape({
    id: Proptypes.string.isRequired,
    price: Proptypes.number.isRequired,
    name: Proptypes.string.isRequired,
    color: Proptypes.string.isRequired,
	quantity: Proptypes.number.isRequired,
  })).isRequired,
  setItems: Proptypes.func.isRequired,
  makePayment: Proptypes.func.isRequired,
  totalPrice: Proptypes.number.isRequired,
  subscription: Proptypes.bool.isRequired,
  setSubscription: Proptypes.func.isRequired,
};
