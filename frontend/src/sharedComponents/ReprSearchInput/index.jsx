import React from 'react';
import PropTypes from 'prop-types';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import { colors } from 'resource/styling';
import useDisplaySize from 'state/useDisplayType';

function ReprSearchInput({
  availableReprs,
  setCurrentRepr,
  setCurrentParty,
  setCurrentHouse,
}) {
  const { type: DisplayType } = useDisplaySize();
  const isMobile = DisplayType === 'mobile';
  const handleChange = (event, newValue) => {
    if (availableReprs.includes(newValue)) {
      setCurrentRepr(newValue.split('-')[0]);
      setCurrentParty(newValue.split('-')[1]);
      setCurrentHouse(newValue.split('-')[2]);
    } else {
      setCurrentRepr(null);
      setCurrentParty(null);
      setCurrentHouse(null);
    }
  };
  return (
    <div
      className={`h-1/2 pb-2 ${
        isMobile ? 'h-[33%] w-[70%] text-xs' : 'w-full'
      }`}
    >
      <Autocomplete
        options={availableReprs || []}
        onChange={handleChange}
        renderInput={(params) => (
          <div
            className={`${colors.primary} ${isMobile ? 'text-xs' : ''} h-10px`}
          >
            <TextField
              // eslint-disable-next-line react/jsx-props-no-spreading
              {...params}
              label="議員を検索"
              variant="outlined" // or "standard"
              size="small" // This also helps reduce padding
              sx={{
                '& .MuiInputBase-input': {
                  fontSize: isMobile ? '10px' : '16px',
                  padding: '4px 8px',
                },
                '& .MuiInputLabel-root': {
                  fontSize: isMobile ? '12px' : '16px',
                },
              }}
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
