import { useRef, useState, useCallback, useEffect } from 'react';

const TOTAL_ROWS = 100;
const TOTAL_COLS = 35;
const ROW_HEIGHT = 40;
const COL_WIDTH = 130;
const HEADER_HEIGHT = 40;
const CONTAINER_HEIGHT = 25 * ROW_HEIGHT; // exactly 25 rows visible, no overscan
const OVERSCAN_ROWS = 0;
const OVERSCAN_COLS = 1;
const VIRTUALIZATION_DELAY_MS = 120; // simulate async DOM update (like React Virtual's rAF cycle)

const COLUMNS = [
    'ID', 'Name', 'Email', 'Status', 'Score', 'Input', 'Output', 'Expected',
    'Tags', 'Quality', 'Duration', 'Tokens', 'Cost', 'Model', 'Created',
    'Updated', 'Region', 'Latency', 'Errors', 'Retries', 'Version', 'Environment',
    'Provider', 'Temperature', 'Max Tokens', 'Stop Reason', 'Cached', 'Batch',
    'Project', 'Dataset', 'Experiment', 'Prompt', 'Completion', 'Category', 'Notes',
];

const STATUSES = ['success', 'error', 'pending', 'cancelled'];
const MODELS = ['gpt-4o', 'claude-3-5', 'gemini-1.5', 'llama-3'];

// Pre-generate all cell values so scroll doesn't recompute
const DATA: string[][] = Array.from({ length: TOTAL_ROWS }, (_, r) =>
    COLUMNS.map((col, c) => {
        switch (col) {
            case 'ID':        return `row-${String(r).padStart(3, '0')}`;
            case 'Name':      return `Experiment ${r + 1}`;
            case 'Email':     return `user${r}@example.com`;
            case 'Status':    return STATUSES[r % STATUSES.length];
            case 'Score':     return (0.5 + (r * 7 + c * 3) % 50 / 100).toFixed(3);
            case 'Input':     return `Input text for row ${r}`;
            case 'Output':    return `Output text for row ${r}`;
            case 'Expected':  return `Expected output ${r}`;
            case 'Tags':      return `tag-${r % 5}, tag-${(r + 1) % 5}`;
            case 'Quality':   return `${(r * 13 % 5) + 1}/5`;
            case 'Duration':  return `${(100 + r * 37 % 900)}ms`;
            case 'Tokens':    return `${500 + r * 23 % 3000}`;
            case 'Cost':      return `$${(0.001 + (r * 0.0003)).toFixed(4)}`;
            case 'Model':     return MODELS[r % MODELS.length];
            case 'Created':   return `2025-01-${String((r % 28) + 1).padStart(2, '0')}`;
            case 'Updated':   return `2025-02-${String((r % 28) + 1).padStart(2, '0')}`;
            case 'Latency':   return `${200 + r * 17 % 800}ms`;
            case 'Errors':    return `${r % 7 === 0 ? 1 : 0}`;
            case 'Retries':   return `${r % 11 === 0 ? 2 : 0}`;
            default:          return `r${r}c${c}`;
        }
    })
);

type Range = { first: number; last: number };

export const Grid2DPage = () => {
    const scrollerRef = useRef<HTMLDivElement>(null);
    const [rowRange, setRowRange] = useState<Range>({ first: 0, last: 24 });
    const [colRange, setColRange] = useState<Range>({ first: 0, last: 9 });

    const onScroll = useCallback(() => {
        const el = scrollerRef.current;
        if (!el) return;
        const { scrollTop, scrollLeft, clientHeight, clientWidth } = el;

        const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS);
        const lastRow = Math.min(TOTAL_ROWS - 1, Math.ceil((scrollTop + clientHeight) / ROW_HEIGHT) - 1 + OVERSCAN_ROWS);

        const firstCol = Math.max(0, Math.floor(scrollLeft / COL_WIDTH) - OVERSCAN_COLS);
        const lastCol = Math.min(TOTAL_COLS - 1, Math.ceil((scrollLeft + clientWidth) / COL_WIDTH) - 1 + OVERSCAN_COLS);

        setTimeout(() => {
            setRowRange({ first: firstRow, last: lastRow });
            setColRange({ first: firstCol, last: lastCol });
        }, VIRTUALIZATION_DELAY_MS);
    }, []);

    useEffect(() => { onScroll(); }, [onScroll]);

    const totalWidth = TOTAL_COLS * COL_WIDTH;
    const totalHeight = TOTAL_ROWS * ROW_HEIGHT;

    const visibleRows: number[] = [];
    for (let r = rowRange.first; r <= rowRange.last; r++) visibleRows.push(r);

    const visibleCols: number[] = [];
    for (let c = colRange.first; c <= colRange.last; c++) visibleCols.push(c);

    return (
        <div>
            <div style={{ marginBottom: 16 }}>
                <h2>2D Virtualized Table</h2>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginTop: 4 }}>
                    {TOTAL_ROWS} rows × {TOTAL_COLS} cols — {visibleRows.length} rows,{' '}
                    {visibleCols.length} cols in DOM
                </p>
            </div>

            {/* Single scroll container — both axes. class="overflow-auto" matches the XPath selector. */}
            <div
                ref={scrollerRef}
                className="overflow-auto"
                onScroll={onScroll}
                style={{
                    height: CONTAINER_HEIGHT,
                    overflow: 'auto',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    position: 'relative',
                    backgroundColor: 'var(--color-surface)',
                }}
            >
                {/* Sticky header — ALL columns always in DOM, never virtualized.
                    Bounding rects must be valid for scrollToColumn to work. */}
                <div
                    data-component="TableHeadersComponent"
                    style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 2,
                        height: HEADER_HEIGHT,
                        width: totalWidth,
                        backgroundColor: '#f7fafc',
                        borderBottom: '2px solid var(--color-border)',
                    }}
                >
                    {COLUMNS.map((col, colIdx) => (
                        <div
                            key={colIdx}
                            data-column-name={col}
                            style={{
                                position: 'absolute',
                                left: colIdx * COL_WIDTH,
                                width: COL_WIDTH,
                                height: HEADER_HEIGHT,
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0 10px',
                                borderRight: '1px solid var(--color-border)',
                                overflow: 'hidden',
                            }}
                        >
                            <span
                                className="draggable-column-header"
                                style={{
                                    fontWeight: 600,
                                    fontSize: 12,
                                    color: 'var(--color-text-secondary)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}
                            >
                                {col}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Virtual rows container — height defines total scroll area */}
                <div style={{ position: 'relative', height: totalHeight, width: totalWidth }}>
                    {visibleRows.map(rowIdx => (
                        <div
                            key={rowIdx}
                            className="group/tablerow"
                            data-index={rowIdx}
                            style={{
                                position: 'absolute',
                                top: rowIdx * ROW_HEIGHT,
                                height: ROW_HEIGHT,
                                width: totalWidth,
                                borderBottom: '1px solid var(--color-border)',
                                backgroundColor: rowIdx % 2 === 0 ? 'white' : '#fafbfc',
                            }}
                        >
                            {visibleCols.map(colIdx => (
                                <div
                                    key={colIdx}
                                    data-index={colIdx}
                                    style={{
                                        position: 'absolute',
                                        left: colIdx * COL_WIDTH,
                                        width: COL_WIDTH,
                                        height: ROW_HEIGHT,
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '0 10px',
                                        fontSize: 13,
                                        borderRight: '1px solid var(--color-border)',
                                        overflow: 'hidden',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {DATA[rowIdx][colIdx]}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
