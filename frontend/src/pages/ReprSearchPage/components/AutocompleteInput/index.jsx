import React from 'react';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Proptypes from 'prop-types';
import { colors } from 'resource/styling';

function AutocompleteInput({ options, setSelectedDistrict, selectedDistrict }) {
  return (
    <Autocomplete
      value={selectedDistrict}
      onChange={(event, newValue) => {
        setSelectedDistrict(newValue);
      }}
      disablePortal
      options={options}
      sx={{ width: 300 }}
      renderInput={(params) => (
        <div className={`${colors.primary}`}>
          {/* eslint-disable-next-line react/jsx-props-no-spreading */}
          <TextField {...params} label="選挙区" variant="filled" />
        </div>
      )}
    />
  );
}

AutocompleteInput.defaultProps = {
  options: [],
  selectedDistrict: '',
};
AutocompleteInput.propTypes = {
  options: Proptypes.arrayOf(Proptypes.string),
  setSelectedDistrict: Proptypes.func.isRequired,
  selectedDistrict: Proptypes.string,
};

export default AutocompleteInput;
