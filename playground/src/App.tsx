
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Home } from './pages/Home';
import { VirtualizedPage } from './pages/VirtualizedPage';

function App() {
  return (
    <BrowserRouter>
      <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
        <nav style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
          <Link to="/" style={{ marginRight: '15px' }}>Home</Link>
          <Link to="/virtualized">Virtualized Table</Link>
        </nav>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/virtualized" element={<VirtualizedPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
