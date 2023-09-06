import React from 'react';
import GridLoader from 'react-spinners/GridLoader';
import SquareLoader from 'react-spinners/SquareLoader';

// eslint-disable-next-line import/prefer-default-export
export const gridLoader = (
  <div className="flex justify-center items-center w-full h-full">
    <GridLoader size={30} />
  </div>
);

export const squareLoader = (
  <div className="flex justify-center items-center w-full h-full">
    <SquareLoader size={30} />
  </div>
);
