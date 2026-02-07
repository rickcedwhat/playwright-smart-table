import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { PlaygroundConfig, Delay, RowConfig, CellConfig } from './ControlPanel';


// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

const resolveDelay = (delay: Delay): number => {
    if (typeof delay === 'number') return delay;
    if (delay && typeof delay === 'object') {
        const { base, stutter } = delay;
        // Random between (base - stutter) and (base + stutter)
        const jitter = (Math.random() * stutter * 2) - stutter;
        return Math.max(0, Math.floor(base + jitter));
    }
    return 0;
};

const resolveValue = (value: any, index: number): any => {
    if (typeof value === 'function') return value(index);
    return value;
};

// ----------------------------------------------------------------------
// Generators
// ----------------------------------------------------------------------

const GENERATORS: Record<string, (index: number) => any> = {
    users: (index) => ({
        id: index + 1,
        name: `User ${index + 1}`,
        email: `user.${index + 1}@example.com`,
        status: index % 5 === 0 ? 'Inactive' : 'Active',
        role: index % 3 === 0 ? 'Admin' : 'Viewer'
    }),
    simple: (index) => ({
        id: index + 1,
        value: `Item ${index + 1}`,
        description: `Description for item ${index + 1}`
    })
};

const getRowData = (index: number, config: PlaygroundConfig): any => {
    const rowConfig = config.rows?.[index];

    // 1. Check for concrete data override
    let source = rowConfig?.data ?? config.defaults.generator;

    // 2. Resolve source to object
    if (typeof source === 'function') {
        return source(index);
    }
    if (typeof source === 'string') {
        const generator = GENERATORS[source];
        if (generator) return generator(index);
        return { error: `Generator '${source}' not found` };
    }
    if (typeof source === 'object') {
        return source;
    }

    return { error: 'Unknown data source' };
};

// ----------------------------------------------------------------------
// Components
// ----------------------------------------------------------------------

interface CellProps {
    content: any;
    columnId: string;
    width: string;
    rowConfig?: RowConfig;
    defaultCellDelay: Delay;
    index: number;
}

const Cell: React.FC<CellProps> = ({ content, columnId, width, rowConfig, defaultCellDelay, index }) => {
    const cellOverride = rowConfig?.cells?.[columnId];

    // Determine delay: Override -> Default
    const delayConfig = cellOverride?.delay ?? defaultCellDelay;
    const resolvedDelay = useMemo(() => resolveDelay(delayConfig), [delayConfig]);

    // Determine content: Override -> Prop
    // Note: If cellOverride.value is present, we use that instead of the prop content
    const resolvedContent = cellOverride?.value !== undefined
        ? resolveValue(cellOverride.value, index)
        : content;

    const [isLoaded, setIsLoaded] = useState(resolvedDelay <= 0);

    useEffect(() => {
        if (!isLoaded && resolvedDelay < Infinity && resolvedDelay >= 0) {
            const timer = setTimeout(() => setIsLoaded(true), resolvedDelay);
            return () => clearTimeout(timer);
        }
    }, [isLoaded, resolvedDelay]);

    if (!isLoaded) {
        return (
            <div style={{ width, paddingRight: '16px', display: 'flex', alignItems: 'center' }}>
                <div style={{ height: '12px', width: '80%', backgroundColor: '#edf2f7', borderRadius: '4px' }} />
            </div>
        );
    }

    // Special styling for specific columns (just for demo purposes)
    if (columnId === 'status') {
        const status = String(resolvedContent);
        const isError = status === 'Error';
        const isInactive = status === 'Inactive';
        return (
            <div style={{ width, paddingRight: '16px' }} role="cell">
                <span style={{
                    padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                    backgroundColor: isError ? '#fed7d7' : (isInactive ? '#edf2f7' : '#c6f6d5'),
                    color: isError ? '#822727' : (isInactive ? '#718096' : '#22543d')
                }}>
                    {resolvedContent}
                </span>
            </div>
        );
    }

    return (
        <div style={{ width, paddingRight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} role="cell">
            {String(resolvedContent)}
        </div>
    );
};

const RowContent = ({ index, data }: { index: number; data: PlaygroundConfig }) => {
    const config = data; // Rename for clarity
    const rowConfig = config.rows?.[index];

    // Determine Row Delay
    const delayConfig = rowConfig?.delay ?? config.defaults.rowDelay;
    // Use useRef to store delay once calculated per mount to avoid jitter re-calc unless config changes
    // Actually simplicity is better for now, useMemo on delayConfig object reference or primitives
    const resolvedRowDelay = useMemo(() => resolveDelay(delayConfig), [delayConfig]);

    const [isRowLoaded, setIsRowLoaded] = useState(resolvedRowDelay <= 0);

    useEffect(() => {
        if (!isRowLoaded && resolvedRowDelay < Infinity && resolvedRowDelay >= 0) {
            const timer = setTimeout(() => setIsRowLoaded(true), resolvedRowDelay);
            return () => clearTimeout(timer);
        }
    }, [isRowLoaded, resolvedRowDelay]);

    // Simple fade-in style
    const style: React.CSSProperties = {
        display: 'flex',
        borderBottom: '1px solid var(--color-border)',
        alignItems: 'center',
        height: '48px', // Fixed height for simplicity
        padding: '0 16px',
        backgroundColor: index % 2 === 0 ? 'white' : '#f8fafc',
        transition: 'background-color 0.2s',
        width: '100%'
    };

    if (!isRowLoaded) {
        return (
            <div className="virtual-row" role="row" style={style}>
                <div className="skeleton-row" style={{ width: '100%', height: '24px', backgroundColor: '#e2e8f0', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
                <style>{`@keyframes pulse { 0 % { opacity: 0.6; } 50 % { opacity: 1; } 100 % { opacity: 0.6; } } `}</style>
            </div>
        );
    }

    const rowData = getRowData(index, config);

    return (
        <div className="virtual-row" role="row" style={style}>
            <Cell index={index} columnId="id" content={rowData.id} width="60px" rowConfig={rowConfig} defaultCellDelay={config.defaults.cellDelay} />
            <Cell index={index} columnId="name" content={rowData.name || rowData.value} width="150px" rowConfig={rowConfig} defaultCellDelay={config.defaults.cellDelay} />
            <Cell index={index} columnId="status" content={rowData.status || 'N/A'} width="100px" rowConfig={rowConfig} defaultCellDelay={config.defaults.cellDelay} />
            <div style={{ flex: 1, display: 'flex' }} role="cell">
                <Cell index={index} columnId="email" content={rowData.email || rowData.description || ''} width="100%" rowConfig={rowConfig} defaultCellDelay={config.defaults.cellDelay} />
            </div>
        </div>
    );
};

export const VirtualizedTable: React.FC<{ config: PlaygroundConfig }> = ({ config }) => {
    return (
        <div className="virtual-table-container" style={{ height: 500, width: '100%', border: '1px solid var(--color-border)' }}>
            <div className="header" style={{
                display: 'flex', fontWeight: 600, padding: '12px 16px',
                borderBottom: '2px solid var(--color-border)', backgroundColor: '#f7fafc',
                color: 'var(--color-text-secondary)', fontSize: '0.875rem'
            }} role="row">
                <div style={{ width: '60px' }} role="columnheader">ID</div>
                <div style={{ width: '150px' }} role="columnheader">Name</div>
                <div style={{ width: '100px' }} role="columnheader">Status</div>
                <div style={{ flex: 1 }} role="columnheader">Email</div>
            </div>

            <Virtuoso
                style={{ height: 'calc(100% - 45px)' }} // Subtract header height
                totalCount={config.rowCount}
                data={new Array(config.rowCount).fill(null).map((_, i) => i)} // Dummy data array for pure index access or just modify itemContent
                itemContent={(index) => <RowContent index={index} data={config} />}
            />
        </div>
    );
};