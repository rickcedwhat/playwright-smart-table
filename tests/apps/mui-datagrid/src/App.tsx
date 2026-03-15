import React from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';

const columns: GridColDef[] = [
  { field: 'id', headerName: 'ID', width: 90 },
  { field: 'Desk', headerName: 'Desk', width: 150, editable: true },
  { field: 'Commodity', headerName: 'Commodity', width: 150, editable: true },
  { field: 'TraderName', headerName: 'Trader Name', width: 150, editable: true },
  { field: 'TraderEmail', headerName: 'Trader Email', width: 200, editable: true },
  { field: 'Quantity', headerName: 'Quantity', type: 'number', width: 110, editable: true },
];

const rows = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  Desk: `D-${1000 + i}`,
  Commodity: i % 2 === 0 ? 'Oil' : 'Gas',
  TraderName: `Trader ${i + 1}`,
  TraderEmail: `trader${i + 1}@example.com`,
  Quantity: Math.floor(Math.random() * 1000),
}));

export default function App() {
  return (
    <div style={{ height: 600, width: '100%' }}>
      <DataGrid
        rows={rows}
        columns={columns}
        pagination
        initialState={{
          pagination: {
            paginationModel: { page: 0, pageSize: 10 },
          },
        }}
        pageSizeOptions={[5, 10, 20]}
        checkboxSelection
        disableRowSelectionOnClick
      />
    </div>
  );
}
