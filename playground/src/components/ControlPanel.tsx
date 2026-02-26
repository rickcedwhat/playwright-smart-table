import React, { useState, useEffect } from 'react';

/**
 * Represents a time duration in milliseconds.
 * - number: Fixed delay (e.g., 500).
 * - object: Randomized delay with a base and +/- deviation.
 *   (e.g., { base: 200, stutter: 50 } => 150-250ms).
 */
export type Delay = number | { base: number; stutter: number };

export interface CellConfig {
    delay?: Delay;
    value?: any;
    cache?: boolean;
}

export interface RowConfig {
    delay?: Delay;
    data?: Record<string, any> | string | ((index: number) => any);
    cells?: Record<string, CellConfig>;
    cache?: boolean;
}

export interface PlaygroundConfig {
    rowCount: number;
    columnCount?: number;
    virtualizeColumns?: boolean;
    virtualizeHeaders?: boolean;
    defaults: {
        tableInitDelay: Delay;
        rowDelay: Delay;
        cellDelay: Delay;
        generator: string | ((index: number) => any);
        tableCache?: boolean;
        rowCache?: boolean;
        cellCache?: boolean;
    };
    rows?: Record<number, RowConfig>;
}

interface ControlPanelProps {
    config: PlaygroundConfig;
    onChange: (newConfig: PlaygroundConfig) => void;
    onReload: () => void;
}

const DEFAULT_JSON = (config: PlaygroundConfig) => JSON.stringify({
    ...config,
    columnCount: config.columnCount ?? 4,
    virtualizeColumns: config.virtualizeColumns ?? false,
    virtualizeHeaders: config.virtualizeHeaders ?? config.virtualizeColumns ?? false
}, null, 2);

export const ControlPanel: React.FC<ControlPanelProps> = ({ config, onChange, onReload }) => {
    const [jsonText, setJsonText] = useState(DEFAULT_JSON(config));
    const [error, setError] = useState<string | null>(null);

    // Sync external config changes to text (unless user is editing and it's invalid)
    useEffect(() => {
        try {
            const currentParsed = JSON.parse(jsonText);
            if (JSON.stringify(currentParsed) !== JSON.stringify(config)) {
                setJsonText(DEFAULT_JSON(config));
            }
        } catch (e) {
            // Ignore parse errors while user is typing, but if config changes externally, we might want to override?
            // For now, let's just respect the prop if it's radically different, but strictly matching JSON is hard.
            // A simpler approach: Only update text if we are not focused? 
            // verifying strict equality is enough.
        }
    }, [config]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setJsonText(text);
        try {
            const parsed = JSON.parse(text);
            setError(null);
            onChange(parsed);
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="card control-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="flex justify-between items-center">
                <div>
                    <h3 style={{ margin: 0 }}>Configuration (JSON)</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                        Edit the config below. Valid JSON is automatically applied.
                    </p>
                </div>
                <button
                    onClick={onReload}
                    disabled={!!error}
                    style={{
                        backgroundColor: error ? 'var(--color-text-secondary)' : 'var(--color-primary)',
                        opacity: error ? 0.5 : 1,
                        cursor: error ? 'not-allowed' : 'pointer'
                    }}
                >
                    Apply & Reload Table
                </button>
            </div>

            <div style={{ position: 'relative' }}>
                <textarea
                    value={jsonText}
                    onChange={handleTextChange}
                    spellCheck={false}
                    style={{
                        width: '100%',
                        height: '400px',
                        fontFamily: 'monospace',
                        fontSize: '14px',
                        padding: '16px',
                        backgroundColor: '#1e1e1e',
                        color: '#d4d4d4',
                        borderRadius: '8px',
                        border: error ? '2px solid var(--color-error)' : '1px solid var(--color-border)',
                        resize: 'vertical',
                        outline: 'none'
                    }}
                />
                {error && (
                    <div style={{
                        position: 'absolute',
                        bottom: '16px',
                        left: '16px',
                        right: '16px',
                        padding: '8px 12px',
                        backgroundColor: 'rgba(229, 62, 62, 0.9)',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '0.875rem'
                    }}>
                        Syntax Error: {error}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '8px', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                <span>Try:</span>
                <button
                    className="link-button"
                    onClick={() => {
                        const newConfig = { ...config, defaults: { ...config.defaults, rowDelay: { base: 200, stutter: 100 } } };
                        setJsonText(DEFAULT_JSON(newConfig));
                        onChange(newConfig);
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                >
                    Add Jitter
                </button>
                <span>|</span>
                <button
                    className="link-button"
                    onClick={() => {
                        const newConfig = {
                            ...config,
                            rows: {
                                ...config.rows,
                                5: { delay: -1, data: "error-row" } // Example
                            }
                        };
                        setJsonText(DEFAULT_JSON(newConfig));
                        onChange(newConfig);
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                >
                    Stuck Row 5
                </button>
            </div>
        </div>
    );
};
