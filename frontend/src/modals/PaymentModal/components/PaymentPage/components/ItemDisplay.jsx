import React, { useEffect } from 'react';
import Proptypes from 'prop-types';

const buttonStyle =
  'border-2 border-grey-500 w-[20px] h-[20px] flex items-center justify-center rounded-lg';

export default function ItemDisplay({ item, setItems }) {
  const [quantity, setQuantity] = React.useState(0);
  useEffect(() => {
    setItems((prevItems) => {
      const newItems = { ...prevItems };
      newItems[item.id] = { ...item, quantity };
      return newItems;
    });
  }, [quantity]);

  return (
    <div
      className="m-2 flex flex-col justify-center items-center"
      key={item.id}
    >
      <div className="flex justify-center items-center">
        <button
          type="button"
          onClick={() => {
            if (quantity > 0) {
              setQuantity(quantity - 1);
            } else {
              setQuantity(0);
            }
          }}
          className={`mr-1 ${buttonStyle}`}
        >
          -
        </button>
        <div>{quantity}</div>
        <button
          className={`ml-1 ${buttonStyle}`}
          type="button"
          onClick={() => setQuantity(quantity + 1)}
        >
          +
        </button>
      </div>
      <div
        className={`${item.color} h-[100px] w-[100px] flex justify-center items-center rounded-lg`}
      >
        <p className="text-center">{item.name}</p>
      </div>
      <div>{item.price}円</div>
    </div>
  );
}

ItemDisplay.propTypes = {
  setItems: Proptypes.func.isRequired,
  item: Proptypes.shape({
    id: Proptypes.string.isRequired,
    price: Proptypes.number.isRequired,
    name: Proptypes.string.isRequired,
    color: Proptypes.string.isRequired,
  }).isRequired,
};
