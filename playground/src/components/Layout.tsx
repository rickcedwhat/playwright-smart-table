
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* Sidebar */}
            <aside style={{
                width: '260px',
                backgroundColor: '#1a202c',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                position: 'fixed',
                height: '100vh',
                zIndex: 10
            }}>
                <div style={{ padding: '24px', borderBottom: '1px solid #2d3748' }}>
                    <h1 style={{ fontSize: '1.25rem', color: 'white', margin: 0 }}>Smart Table Dev</h1>
                </div>

                <nav style={{ flex: 1, padding: '24px 0' }}>
                    <NavLink to="/" label="Home" active={isActive('/')} />
                    <NavLink to="/virtualized" label="Virtualized Table" active={isActive('/virtualized')} />
                </nav>

                <div style={{ padding: '24px', fontSize: '0.75rem', color: '#718096' }}>
                    Last Updated: {new Date().toLocaleDateString()}
                </div>
            </aside>

            {/* Main Content */}
            <main style={{
                flex: 1,
                marginLeft: '260px',
                padding: '32px',
                backgroundColor: 'var(--color-background)',
                minHeight: '100vh'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    {children}
                </div>
            </main>
        </div>
    );
};

const NavLink: React.FC<{ to: string, label: string, active: boolean }> = ({ to, label, active }) => (
    <Link
        to={to}
        style={{
            display: 'block',
            padding: '12px 24px',
            color: active ? 'white' : '#a0aec0',
            backgroundColor: active ? '#2d3748' : 'transparent',
            borderLeft: active ? '4px solid #4299e1' : '4px solid transparent',
            transition: 'all 0.2s',
            fontWeight: active ? 500 : 400
        }}
    >
        {label}
    </Link>
);

export default Layout;
