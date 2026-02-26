import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { PlaygroundConfig, Delay, RowConfig } from './ControlPanel';


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
    onCellLoaded?: (index: number, colId: string) => void;
    isCellCached?: (index: number, colId: string) => boolean;
    defaultCacheEnabled?: boolean;
}

const Cell: React.FC<CellProps> = ({ content, columnId, width, rowConfig, defaultCellDelay, index, onCellLoaded, isCellCached, defaultCacheEnabled }) => {
    const cellOverride = rowConfig?.cells?.[columnId];

    // Determine delay: Override -> Default
    const delayConfig = cellOverride?.delay ?? defaultCellDelay;
    const resolvedDelay = useMemo(() => resolveDelay(delayConfig), [delayConfig]);

    // Determine content: Override -> Prop
    // Note: If cellOverride.value is present, we use that instead of the prop content
    const resolvedContent = cellOverride?.value !== undefined
        ? resolveValue(cellOverride.value, index)
        : content;

    const cacheEnabled = cellOverride?.cache ?? defaultCacheEnabled;
    const isCached = cacheEnabled && isCellCached && isCellCached(index, columnId);
    const [isLoaded, setIsLoaded] = useState(!!isCached || resolvedDelay <= 0);

    useEffect(() => {
        if (!isLoaded && resolvedDelay < Infinity && resolvedDelay >= 0) {
            const timer = setTimeout(() => {
                setIsLoaded(true);
                onCellLoaded?.(index, columnId);
            }, resolvedDelay);
            return () => clearTimeout(timer);
        } else if (isLoaded) {
            onCellLoaded?.(index, columnId);
        }
    }, [isLoaded, resolvedDelay, index, columnId, onCellLoaded]);

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

const RowContent = ({ index, data, columns, scrollerRef, onRowLoaded, isRowCached, onCellLoaded, isCellCached }: {
    index: number;
    data: PlaygroundConfig;
    columns: any[];
    scrollerRef: React.RefObject<HTMLElement | null>;
    onRowLoaded: (index: number) => void;
    isRowCached: (index: number) => boolean;
    onCellLoaded: (index: number, colId: string) => void;
    isCellCached: (index: number, colId: string) => boolean;
}) => {
    const config = data; // Rename for clarity
    const rowConfig = config.rows?.[index];

    // Determine Row Delay
    const delayConfig = rowConfig?.delay ?? config.defaults.rowDelay;
    const resolvedRowDelay = useMemo(() => resolveDelay(delayConfig), [delayConfig]);

    const isCached = (rowConfig?.cache ?? config.defaults.rowCache) && isRowCached(index);
    const [isRowLoaded, setIsRowLoaded] = useState(isCached || resolvedRowDelay <= 0);

    const [visibleRange, setVisibleRange] = useState({ start: 0, end: columns.length });

    useEffect(() => {
        if (!config.virtualizeColumns || !scrollerRef.current) {
            setVisibleRange({ start: 0, end: columns.length });
            return;
        }

        const scroller = scrollerRef.current;
        let ticking = false;
        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const sl = scroller.scrollLeft;
                    const width = scroller.clientWidth || window.innerWidth;
                    const avgWidth = 150;
                    const start = Math.max(0, Math.floor(sl / avgWidth) - 4);
                    const end = Math.min(columns.length, Math.ceil((sl + width) / avgWidth) + 4);
                    setVisibleRange({ start, end });
                    ticking = false;
                });
                ticking = true;
            }
        };

        scroller.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', handleScroll);
        handleScroll(); // init

        return () => {
            scroller.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleScroll);
        };
    }, [config.virtualizeColumns, columns.length, scrollerRef]);

    useEffect(() => {
        if (!isRowLoaded && resolvedRowDelay < Infinity && resolvedRowDelay >= 0) {
            const timer = setTimeout(() => {
                setIsRowLoaded(true);
                onRowLoaded(index);
            }, resolvedRowDelay);
            return () => clearTimeout(timer);
        } else if (isRowLoaded) {
            onRowLoaded(index); // Mark as loaded if 0 delay or cached
        }
    }, [isRowLoaded, resolvedRowDelay, index, onRowLoaded]);

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
    const cellProps = { index, rowConfig, defaultCellDelay: config.defaults.cellDelay, onCellLoaded, isCellCached, defaultCacheEnabled: config.defaults.cellCache };

    return (
        <div className="virtual-row" role="row" style={style}>
            {columns.map((col, i) => {
                const isVisible = i >= visibleRange.start && i < visibleRange.end;
                if (!isVisible) {
                    return <div key={col.id} style={{ width: col.width, flexShrink: 0 }} role="cell" />;
                }

                let content = rowData[col.id];
                if (content === undefined) {
                    // Fallbacks for standard generated data keys
                    if (col.id === 'name') content = rowData.name || rowData.value;
                    else if (col.id === 'email') content = rowData.email || rowData.description;
                    else if (col.id === 'status') content = rowData.status || 'N/A';
                    else content = `Data for Row ${index + 1} ${col.title}`;
                }

                return (
                    <Cell
                        key={col.id}
                        columnId={col.id}
                        content={content}
                        width={`${col.width}px`}
                        {...cellProps}
                    />
                );
            })}
        </div>
    );
};

const VirtualizedHeader = ({ columns, config, scrollerRef }: { columns: any[], config: PlaygroundConfig, scrollerRef: React.RefObject<HTMLElement | null> }) => {
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: columns.length });

    useEffect(() => {
        const shouldVirtualizeHeaders = config.virtualizeHeaders ?? config.virtualizeColumns ?? false;
        if (!shouldVirtualizeHeaders || !scrollerRef.current) {
            setVisibleRange({ start: 0, end: columns.length });
            return;
        }

        const scroller = scrollerRef.current;
        let ticking = false;
        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const sl = scroller.scrollLeft;
                    const width = scroller.clientWidth || window.innerWidth;
                    const avgWidth = 150;
                    const start = Math.max(0, Math.floor(sl / avgWidth) - 4);
                    const end = Math.min(columns.length, Math.ceil((sl + width) / avgWidth) + 4);
                    setVisibleRange({ start, end });
                    ticking = false;
                });
                ticking = true;
            }
        };

        scroller.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', handleScroll);
        handleScroll(); // init

        return () => {
            scroller.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleScroll);
        };
    }, [config.virtualizeColumns, columns.length, scrollerRef]);

    return (
        <>
            {columns.map((col, i) => {
                const isVisible = i >= visibleRange.start && i < visibleRange.end;
                if (!isVisible) return <div key={col.id} style={{ width: col.width, flexShrink: 0 }} role="columnheader" />;
                return (
                    <div key={col.id} style={{ width: col.width, flexShrink: 0 }} role="columnheader">
                        {col.title}
                    </div>
                );
            })}
        </>
    );
};

const COLUMNS_BASE = [
    { id: 'id', title: 'ID', width: 60 },
    { id: 'name', title: 'Name', width: 150 },
    { id: 'status', title: 'Status', width: 100 },
    { id: 'email', title: 'Email', width: 250 },
];

export const VirtualizedTable: React.FC<{ config: PlaygroundConfig }> = ({ config }) => {
    // Cache references (persist as long as this component is mounted)
    const loadedRows = useRef(new Set<number>());
    const loadedCells = useRef(new Set<string>());

    const scrollerRef = useRef<HTMLElement | null>(null);
    const headerRef = useRef<HTMLDivElement | null>(null);

    const columnCount = config.columnCount ?? 4;
    const columns = useMemo(() => {
        const cols = [...COLUMNS_BASE];
        for (let i = 4; i < columnCount; i++) {
            cols.push({ id: `col_${i + 1}`, title: `Column ${i + 1}`, width: 150 });
        }
        return cols;
    }, [columnCount]);

    const totalWidth = useMemo(() => columns.reduce((sum, col) => sum + col.width, 0) + 32, [columns]); // +32 for row padding

    const onRowLoaded = useMemo(() => (index: number) => {
        loadedRows.current.add(index);
    }, []);

    const isRowCached = useMemo(() => (index: number) => {
        return loadedRows.current.has(index);
    }, []);

    const onCellLoaded = useMemo(() => (index: number, colId: string) => {
        loadedCells.current.add(`${index}:${colId}`);
    }, []);

    const isCellCached = useMemo(() => (index: number, colId: string) => {
        return loadedCells.current.has(`${index}:${colId}`);
    }, []);

    return (
        <div
            className="virtual-table-container"
            style={{ height: 500, width: '100%', border: '1px solid var(--color-border)' }}
            data-debug-row-delay={typeof config.defaults.rowDelay === 'object' ? config.defaults.rowDelay.base : config.defaults.rowDelay}
        >
            <div
                ref={headerRef}
                className="header"
                style={{
                    display: 'flex', fontWeight: 600, padding: '12px 16px',
                    borderBottom: '2px solid var(--color-border)', backgroundColor: '#f7fafc',
                    color: 'var(--color-text-secondary)', fontSize: '0.875rem',
                    overflowX: 'hidden', // virtuosso handles x scroll
                    width: '100%'
                }}
                role="row"
            >
                <div style={{ display: 'flex', width: totalWidth - 32 }}>
                    <VirtualizedHeader columns={columns} config={config} scrollerRef={scrollerRef} />
                </div>
            </div>

            <Virtuoso
                scrollerRef={(ref) => scrollerRef.current = ref as HTMLElement}
                onScroll={(e) => {
                    const target = e.currentTarget as HTMLElement;
                    if (headerRef.current) {
                        headerRef.current.scrollLeft = target.scrollLeft;
                    }
                }}
                style={{ height: 'calc(100% - 45px)', overflowX: 'auto' }} // Subtract header height
                totalCount={config.rowCount}
                data={new Array(config.rowCount).fill(null).map((_, i) => i)} // Dummy data array for pure index access or just modify itemContent
                itemContent={(index) => (
                    <div style={{ width: totalWidth, display: 'flex' }}>
                        <RowContent
                            index={index}
                            data={config}
                            columns={columns}
                            scrollerRef={scrollerRef}
                            onRowLoaded={onRowLoaded}
                            isRowCached={isRowCached}
                            onCellLoaded={onCellLoaded}
                            isCellCached={isCellCached}
                        />
                    </div>
                )}
            />
        </div>
    );
};