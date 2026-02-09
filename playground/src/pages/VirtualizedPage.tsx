import { useState, useEffect } from 'react';
import { ControlPanel, type PlaygroundConfig } from '../components/ControlPanel';
import { VirtualizedTable } from '../components/VirtualizedTable';

const DEFAULT_CONFIG: PlaygroundConfig = {
    rowCount: 1000,
    defaults: {
        tableInitDelay: 500,
        rowDelay: 100,
        cellDelay: 0,
        generator: 'users'
    }
};

export const VirtualizedPage = () => {
    const [config, setConfig] = useState<PlaygroundConfig>(DEFAULT_CONFIG);
    const [isTableLoading, setIsTableLoading] = useState(false);
    const [tableKey, setTableKey] = useState(0); // Used to force re-render
    const [hasLoadedTable, setHasLoadedTable] = useState(false);

    const handleReload = () => {
        setIsTableLoading(true);
        // Resolve delay (handle number vs object)
        const delayConfig = config.defaults.tableInitDelay;
        let delay = 0;

        // Use cache: if loaded once and tableCache is true, skip delay
        if (config.defaults.tableCache && hasLoadedTable) {
            delay = 0;
        } else if (typeof delayConfig === 'number') {
            delay = delayConfig;
        } else if (delayConfig && typeof delayConfig === 'object') {
            delay = delayConfig.base; // Use base for simple table init
        }

        setTimeout(() => {
            setIsTableLoading(false);
            setHasLoadedTable(true);
            setTableKey(prev => prev + 1); // Force new table instance if needed
        }, delay);
    };

    // Initial load
    useEffect(() => {
        handleReload();
    }, []);

    return (
        <div>
            <div style={{ marginBottom: '24px' }}>
                <h2>Virtualized Table Scenario</h2>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                    Advanced configuration for simulating real-world loading conditions.
                </p>
            </div>

            <ControlPanel
                config={config}
                onChange={setConfig}
                onReload={handleReload}
            />

            <div className="card" style={{ padding: 0, overflow: 'hidden', minHeight: '500px', position: 'relative' }}>
                {isTableLoading && (
                    <div style={{
                        position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.8)',
                        zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backdropFilter: 'blur(2px)'
                    }}>
                        <div className="flex flex-col items-center">
                            <div className="spinner" style={{
                                width: '40px', height: '40px', border: '4px solid #e2e8f0',
                                borderTopColor: 'var(--color-primary)', borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }} />
                            <span style={{ marginTop: '16px', fontWeight: 500, color: 'var(--color-primary)' }}>Loading Table Data...</span>
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        </div>
                    </div>
                )}

                <VirtualizedTable
                    key={tableKey}
                    config={config}
                />
            </div>
        </div>
    );
};
