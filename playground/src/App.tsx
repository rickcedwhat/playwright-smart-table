
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { VirtualizedPage } from './pages/VirtualizedPage';
import { Grid2DPage } from './pages/Grid2DPage';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/virtualized', label: 'Virtualized Table' },
  { to: '/grid-2d', label: '2D Virtualized' },
];

function Nav() {
  const { pathname } = useLocation();
  return (
    <nav style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px', display: 'flex', gap: '4px' }}>
      {NAV_LINKS.map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            fontWeight: pathname === to ? 600 : 400,
            color: pathname === to ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            backgroundColor: pathname === to ? 'rgba(0,102,204,0.08)' : 'transparent',
            fontSize: 14,
          }}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
        <Nav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/virtualized" element={<VirtualizedPage />} />
          <Route path="/grid-2d" element={<Grid2DPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
