// Local replica of https://mui.com/material-ui/react-table/ for hermetic PR CI (#474).
// The demos in ./demos are copied verbatim from mui/material-ui (MIT):
//   docs/data/material/components/table/{BasicTable,DataTable,EnhancedTable}.tsx
// Sections appear in the same order and under the same headings as the docs page.
import React from 'react';
import ReactDOM from 'react-dom/client';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import BasicTable from './demos/BasicTable';
import DataTable from './demos/DataTable';
import EnhancedTable from './demos/EnhancedTable';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        {title}
      </Typography>
      {children}
    </section>
  );
}

function App() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Table
      </Typography>
      <Section title="Basic table">
        <BasicTable />
      </Section>
      <Section title="Data table">
        <DataTable />
      </Section>
      <Section title="Sorting & selecting">
        <EnhancedTable />
      </Section>
    </Container>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CssBaseline />
    <App />
  </React.StrictMode>
);
