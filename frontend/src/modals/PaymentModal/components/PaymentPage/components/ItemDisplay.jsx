import React, { useEffect } from 'react';
import Proptypes from 'prop-types';

const buttonStyle =
  'border-2 border-grey-500 w-[20px] h-[20px] flex items-center justify-center rounded-lg hover:scale-125 transition-all duration-200 ease-in-out';

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
      className="m-2 flex flex-col justify-center items-center h-[80%]"
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
        className={`${item.color} w-auto flex justify-evenly items-center rounded-lg flex-col px-3 h-[80%]`}
      >
        <p className="text-center whitespace-nowrap">{item.name}</p>
        <p>{item.price}円</p>
      </div>
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
