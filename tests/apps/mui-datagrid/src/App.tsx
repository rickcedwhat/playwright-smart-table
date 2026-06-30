import React from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';

// Wide columns force column virtualization (total > viewport width)
const columns: GridColDef[] = [
  { field: 'id', headerName: 'ID', width: 90 },
  { field: 'Desk', headerName: 'Desk', width: 150, editable: true },
  { field: 'Commodity', headerName: 'Commodity', width: 150, editable: true },
  { field: 'TraderName', headerName: 'Trader Name', width: 150, editable: true },
  { field: 'TraderEmail', headerName: 'Trader Email', width: 200, editable: true },
  { field: 'Quantity', headerName: 'Quantity', type: 'number', width: 120, editable: true },
  { field: 'FilledQty', headerName: 'Filled Qty', type: 'number', width: 120, editable: true },
  { field: 'Status', headerName: 'Status', width: 120, editable: true },
  { field: 'Region', headerName: 'Region', width: 120, editable: true },
  { field: 'Currency', headerName: 'Currency', width: 100, editable: true },
  { field: 'Price', headerName: 'Price', type: 'number', width: 110, editable: true },
  { field: 'Notes', headerName: 'Notes', width: 200, editable: true },
];

const STATUSES = ['Open', 'Filled', 'Cancelled', 'Pending'];
const REGIONS = ['EMEA', 'APAC', 'AMER', 'LATAM'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY'];

const rows = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  Desk: `D-${1000 + i}`,
  Commodity: i % 2 === 0 ? 'Oil' : 'Gas',
  TraderName: `Trader ${i + 1}`,
  TraderEmail: `trader${i + 1}@example.com`,
  Quantity: (i + 1) * 100,
  FilledQty: Math.floor((i + 1) * 100 * 0.75),
  Status: STATUSES[i % 4],
  Region: REGIONS[i % 4],
  Currency: CURRENCIES[i % 4],
  Price: parseFloat((10 + i * 0.5).toFixed(2)),
  Notes: `Note for row ${i + 1}`,
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
