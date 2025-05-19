import React from 'react';
import PropTypes from 'prop-types';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import { colors } from '../../../../resource/styling';

function ReprSearchInput({ availableReprs, setCurrentRepr, setCurrentParty, setCurrentHouse }) {
  const handleChange = (event, newValue) => {
	if (availableReprs.includes(newValue)) {
		setCurrentRepr(newValue.split('-')[0]);
		setCurrentParty(newValue.split('-')[1]);
		setCurrentHouse(newValue.split('-')[2]);
	}
	else{
		setCurrentRepr(null);
		setCurrentParty(null);
		setCurrentHouse(null);
	}
  }
  return (
    <div className="w-full max-w-md h-1/2 pb-2">
      <Autocomplete
        options={availableReprs || []}
        onChange={handleChange}
        renderInput={(params) => (
          <div className={`${colors.primary}`}>
            <TextField
			  // eslint-disable-next-line react/jsx-props-no-spreading
              {...params}
              label="議員を検索"
              variant="filled"
              fullWidth
            />
          </div>
        )}
        className="w-full"
      />
    </div>
  );
}

ReprSearchInput.propTypes = {
  availableReprs: PropTypes.arrayOf(PropTypes.string),
  setCurrentRepr: PropTypes.func.isRequired,
  setCurrentParty: PropTypes.func.isRequired,
  setCurrentHouse: PropTypes.func.isRequired,
};

ReprSearchInput.defaultProps = {
  availableReprs: [],
};

export default ReprSearchInput;