import React, { useEffect, useRef, useState } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import Proptypes from 'prop-types';

export default function DataTable({ data, columns, getRowId }) {
  const [dataGridSize, setDataGridSize] = useState(0);
  const sizeRef = useRef(null);
  sizeRef.current = document.getElementById('datagrid');
  const rowHeight = 40;

  useEffect(() => {
    if (sizeRef.current) {
      setDataGridSize(Math.floor(sizeRef.current.offsetHeight / rowHeight));
    }
  }, [sizeRef.current]);

  return (
    <div id="datagrid" style={{ height: '100%', width: '100%' }} ref={sizeRef}>
      <DataGrid
        rows={data}
        columns={columns}
        rowHeight={rowHeight}
        getRowId={getRowId}
        initialState={{
          pagination: {
            paginationModel: {
              page: 0,
              pageSize: dataGridSize || 18,
            },
          },
        }}
      />
    </div>
  );
}

DataTable.defaultProps = { data: [] };

DataTable.propTypes = {
  data: Proptypes.arrayOf(
    Proptypes.shape({
      link: Proptypes.string,
      icon: Proptypes.element,
      title: Proptypes.string,
    })
  ),
  // eslint-disable-next-line
  columns: Proptypes.arrayOf(Proptypes.object).isRequired,
  getRowId: Proptypes.func.isRequired,
};
