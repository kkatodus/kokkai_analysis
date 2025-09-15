import React, { useState } from 'react';
import { RxCross1 } from 'react-icons/rx';
import { paymentEndpoint } from 'resource/resources';
import useModalState from 'modals/useModalState';
import DonationPage from './components/DonationPage';
import PaymentPage from './components/PaymentPage';

export default function PaymentModal() {
  const { modalsState, removeModal } = useModalState();
  const [modalPage, setModalPage] = useState('donation');
  const [subscription, setSubscription] = useState(false);
  const [items, setItems] = useState({
    s: {
      price: 100,
      quantity: 0,
      name: 'ちょっと応援する',
	  color: 'bg-blue-200',
	  id: 's',
    },
    m: {
      price: 1000,
      quantity: 0,
      name: 'もっと応援する',
	  color: 'bg-blue-300',
	  id: 'm',
    },
    l: {
      price: 10000,
      quantity: 0,
      name: 'めっちゃ応援する',
	  color: 'bg-blue-400',
	  id: 'l',
    },
  });

  const totalPrice = Object.values(items).reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  if (modalsState.indexOf('payment') === -1) {
    return null;
  }
  const makePayment = async () => {
    fetch(`${paymentEndpoint}${subscription ? 'create-subscription-session' : 'create-payment-session'}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        window.location.href = data.url;
      })
      .catch((err) => console.log(err));
  };

  return (
    <div className="h-full w-full flex flex-col justify-center items-center">
      <button
        className="right-0 top-0 absolute transition hover:scale-125 mt-2 mr-2"
        onClick={() => removeModal('payment')}
        type="button"
      >
        <RxCross1 className="h-10 w-10" />
      </button>
      {modalPage === 'donation' && <DonationPage setModalPage={setModalPage} />}
      {modalPage === 'payment' && (
        <PaymentPage
		  items={items}
          setItems={setItems}	
          makePayment={makePayment}
          totalPrice={totalPrice}
		  subscription={subscription}
		  setSubscription={setSubscription}
        />
      )}
    </div>
  );
}
