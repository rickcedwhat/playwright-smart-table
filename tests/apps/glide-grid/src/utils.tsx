// Mock-data helpers for the Glide "Add data" story replica (#474).
// Copied from glideapps/glide-data-grid (MIT): packages/core/src/data-editor/stories/utils.tsx
// Local changes: imports point at the published package, the @linaria/react `styled` wrappers
// are plain inline styles, and avatar images are served locally instead of from picsum.photos.
/* eslint-disable sonarjs/no-identical-functions */
import * as React from "react";

import {
    type DataEditorProps,
    type EditableGridCell,
    type GridCell,
    GridCellKind,
    type GridColumn,
    GridColumnIcon,
    isEditableGridCell,
    isTextEditableGridCell,
    type Item,
} from "@glideapps/glide-data-grid";
import { faker } from "@faker-js/faker";
import isArray from "lodash/isArray.js";
import { useResizeDetector } from "react-resize-detector";

const browserIsFirefox = { value: typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent) };

const beautifulStyle: React.CSSProperties = {
    background: "linear-gradient(90deg, #2790b9, #2070a9)",
    color: "white",
    padding: "32px 48px",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    fontFamily: "sans-serif",
    boxSizing: "border-box",
};

const sizerStyle: React.CSSProperties = {
    flexGrow: 1,
    backgroundColor: "white",
    borderRadius: 12,
    boxShadow: "rgba(9, 30, 66, 0.25) 0px 4px 8px -2px, rgba(9, 30, 66, 0.08) 0px 0px 0px 1px",
};

const sizerClipStyle: React.CSSProperties = {
    borderRadius: 12,
    overflow: "hidden",
    transform: "translateZ(0)",
    height: "100%",
};

const BeautifulStyle: React.FC<React.PropsWithChildren<{ className?: string }>> = p => (
    <div className={p.className} style={beautifulStyle}>
        {p.children}
    </div>
);

export const Description: React.FC<React.PropsWithChildren> = p => (
    <p style={{ fontSize: 18, flexShrink: 0, margin: "0 0 20px 0" }}>{p.children}</p>
);

export const MoreInfo: React.FC<React.PropsWithChildren> = p => (
    <p style={{ fontSize: 14, flexShrink: 0, margin: "0 0 20px 0" }}>{p.children}</p>
);

export const KeyName: React.FC<React.PropsWithChildren> = p => (
    <kbd
        style={{
            backgroundColor: "#f4f4f4",
            color: "#2b2b2b",
            padding: "2px 6px",
            fontFamily: "monospace",
            fontSize: 14,
            borderRadius: 4,
            boxShadow: "0px 1px 2px #00000040",
            margin: "0 0.1em",
        }}>
        {p.children}
    </kbd>
);

faker.seed(1337);

function isTruthy(x: any): boolean {
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    return x ? true : false;
}

/**
 * Attempts to copy data between grid cells of any kind.
 */
export function lossyCopyData<T extends EditableGridCell>(source: EditableGridCell, target: T): EditableGridCell {
    const sourceData = source.data;
    if (typeof sourceData === typeof target.data) {
        return {
            ...target,
            data: sourceData as any,
        };
    } else
        switch (target.kind) {
            case GridCellKind.Uri: {
                if (isArray(sourceData)) {
                    return {
                        ...target,
                        data: sourceData[0],
                    };
                }
                return {
                    ...target,
                    data: sourceData?.toString() ?? "",
                };
            }
            case GridCellKind.Boolean: {
                if (isArray(sourceData)) {
                    return {
                        ...target,
                        data: sourceData[0] !== undefined,
                    };
                } else if (source.kind === GridCellKind.Boolean) {
                    return {
                        ...target,
                        data: source.data,
                    };
                }
                return {
                    ...target,
                    data: isTruthy(sourceData) ? true : false,
                };
            }
            case GridCellKind.Image: {
                if (isArray(sourceData)) {
                    return {
                        ...target,
                        data: [sourceData[0]],
                    };
                }
                return {
                    ...target,
                    data: [sourceData?.toString() ?? ""],
                };
            }
            case GridCellKind.Number: {
                return {
                    ...target,
                    data: 0,
                };
            }
            case GridCellKind.Text:
            case GridCellKind.Markdown: {
                if (isArray(sourceData)) {
                    return {
                        ...target,
                        data: sourceData[0].toString() ?? "",
                    };
                }

                return {
                    ...target,
                    data: source.data?.toString() ?? "",
                };
            }
            case GridCellKind.Custom: {
                return target;
            }
            // No default
        }
}

export type GridColumnWithMockingInfo = GridColumn & {
    getContent(): GridCell;
};

export function getGridColumn(columnWithMock: GridColumnWithMockingInfo): GridColumn {
    const { getContent, ...rest } = columnWithMock;

    return rest;
}

interface BeautifulProps {
    title: string;
    description?: React.ReactNode;
    className?: string;
    scale?: string;
}

export const BeautifulWrapper: React.FC<React.PropsWithChildren<BeautifulProps>> = p => {
    const { title, children, description, className, scale } = p;

    const { ref, width, height } = useResizeDetector();

    return (
        <BeautifulStyle className={className + (browserIsFirefox.value ? " firefox" : "")}>
            <h1 style={{ fontSize: 50, fontWeight: 600, flexShrink: 0, margin: "0 0 12px 0" }}>{title}</h1>
            {description}
            <div style={{ ...sizerStyle, scale }} className="sizer">
                <div className="sizer-clip" style={sizerClipStyle} ref={ref}>
                    <div
                        style={{
                            position: "relative",
                            width: width ?? 100,
                            height: height ?? 100,
                        }}>
                        {children}
                    </div>
                </div>
            </div>
        </BeautifulStyle>
    );
};


function createTextColumnInfo(index: number, group: boolean): GridColumnWithMockingInfo {
    return {
        title: `Column ${index}`,
        id: `Column ${index}`,
        group: group ? `Group ${Math.round(index / 3)}` : undefined,
        icon: GridColumnIcon.HeaderString,
        hasMenu: false,
        getContent: () => {
            const text = faker.lorem.word();

            return {
                kind: GridCellKind.Text,
                data: text,
                displayData: text,
                allowOverlay: true,
                readonly: true,
            };
        },
    };
}

function getResizableColumns(amount: number, group: boolean): GridColumnWithMockingInfo[] {
    const defaultColumns: GridColumnWithMockingInfo[] = [
        {
            title: "First name",
            id: "First name",
            group: group ? "Name" : undefined,
            icon: GridColumnIcon.HeaderString,
            hasMenu: false,
            getContent: () => {
                const firstName = faker.name.firstName();
                return {
                    kind: GridCellKind.Text,
                    displayData: firstName,
                    data: firstName,
                    allowOverlay: true,
                    readonly: true,
                };
            },
        },
        {
            title: "Last name",
            id: "Last name",
            group: group ? "Name" : undefined,
            icon: GridColumnIcon.HeaderString,
            hasMenu: false,
            getContent: () => {
                const lastName = faker.name.lastName();
                return {
                    kind: GridCellKind.Text,
                    displayData: lastName,
                    data: lastName,
                    allowOverlay: true,
                    readonly: true,
                };
            },
        },
        {
            title: "Avatar",
            id: "Avatar",
            group: group ? "Info" : undefined,
            icon: GridColumnIcon.HeaderImage,
            hasMenu: false,
            getContent: () => {
                const n = Math.round(Math.random() * 100);
                return {
                    kind: GridCellKind.Image,
                    data: [`/avatar.svg?id=${n}&size=900`],
                    displayData: [`/avatar.svg?id=${n}&size=40`],
                    allowOverlay: true,
                    readonly: true,
                };
            },
        },
        {
            title: "Email",
            id: "Email",
            group: group ? "Info" : undefined,
            icon: GridColumnIcon.HeaderString,
            hasMenu: false,
            getContent: () => {
                const email = faker.internet.email();
                return {
                    kind: GridCellKind.Text,
                    displayData: email,
                    data: email,
                    allowOverlay: true,
                    readonly: true,
                };
            },
        },
        {
            title: "Title",
            id: "Title",
            group: group ? "Info" : undefined,
            icon: GridColumnIcon.HeaderString,
            hasMenu: false,
            getContent: () => {
                const company = faker.name.jobTitle();
                return {
                    kind: GridCellKind.Text,
                    displayData: company,
                    data: company,
                    allowOverlay: true,
                    readonly: true,
                };
            },
        },
        {
            title: "More Info",
            id: "More Info",
            group: group ? "Info" : undefined,
            icon: GridColumnIcon.HeaderUri,
            hasMenu: false,
            getContent: () => {
                const url = faker.internet.url();
                return {
                    kind: GridCellKind.Uri,
                    displayData: url,
                    data: url,
                    hoverEffect: true,
                    allowOverlay: true,
                    readonly: true,
                    onClickUri: a => {
                        window.open(url, "_blank");
                        a.preventDefault();
                    },
                };
            },
        },
    ];

    if (amount < defaultColumns.length) {
        return defaultColumns.slice(0, amount);
    }

    const extraColumnsAmount = amount - defaultColumns.length;

    // eslint-disable-next-line unicorn/no-new-array
    const extraColumns = [...new Array(extraColumnsAmount)].map((_, index) =>
        createTextColumnInfo(index + defaultColumns.length, group)
    );

    return [...defaultColumns, ...extraColumns];
}

export class ContentCache {
    // column -> row -> value
    private cachedContent: Map<number, GridCell[]> = new Map();

    get(col: number, row: number) {
        const colCache = this.cachedContent.get(col);

        if (colCache === undefined) {
            return undefined;
        }

        return colCache[row];
    }

    set(col: number, row: number, value: GridCell) {
        let rowCache = this.cachedContent.get(col);
        if (rowCache === undefined) {
            this.cachedContent.set(col, (rowCache = []));
        }
        rowCache[row] = value;
    }
}

export function useMockDataGenerator(numCols: number, readonly: boolean = true, group: boolean = false) {
    const cache = React.useRef<ContentCache>(new ContentCache());

    const [colsMap, setColsMap] = React.useState(() => getResizableColumns(numCols, group));

    React.useEffect(() => {
        setColsMap(getResizableColumns(numCols, group));
    }, [group, numCols]);

    const onColumnResize = React.useCallback((column: GridColumn, newSize: number) => {
        setColsMap(prevColsMap => {
            const index = prevColsMap.findIndex(ci => ci.title === column.title);
            const newArray = [...prevColsMap];
            newArray.splice(index, 1, {
                ...prevColsMap[index],
                width: newSize,
            });
            return newArray;
        });
    }, []);

    const cols = React.useMemo(() => {
        return colsMap.map(getGridColumn);
    }, [colsMap]);

    const colsMapRef = React.useRef(colsMap);
    colsMapRef.current = colsMap;
    const getCellContent = React.useCallback(
        ([col, row]: Item): GridCell => {
            let val = cache.current.get(col, row);
            if (val === undefined) {
                val = colsMapRef.current[col].getContent();
                if (!readonly && isTextEditableGridCell(val)) {
                    val = { ...val, readonly };
                }
                cache.current.set(col, row, val);
            }
            return val;
        },
        [readonly]
    );

    const setCellValueRaw = React.useCallback(([col, row]: Item, val: GridCell): void => {
        cache.current.set(col, row, val);
    }, []);

    const setCellValue = React.useCallback(
        ([col, row]: Item, val: GridCell): void => {
            let current = cache.current.get(col, row);
            if (current === undefined) {
                current = colsMap[col].getContent();
            }
            if (isEditableGridCell(val) && isEditableGridCell(current)) {
                const copied = lossyCopyData(val, current);
                cache.current.set(col, row, {
                    ...copied,
                    displayData: typeof copied.data === "string" ? copied.data : (copied as any).displayData,
                    lastUpdated: performance.now(),
                } as any);
            }
        },
        [colsMap]
    );

    return { cols, getCellContent, onColumnResize, setCellValue, setCellValueRaw };
}

export const defaultProps: Partial<DataEditorProps> = {
    smoothScrollX: true,
    smoothScrollY: true,
    getCellsForSelection: true,
    width: "100%",
};

export function clearCell(cell: GridCell): GridCell {
    switch (cell.kind) {
        case GridCellKind.Boolean: {
            return {
                ...cell,
                data: false,
            };
        }
        case GridCellKind.Image: {
            return {
                ...cell,
                data: [],
                displayData: [],
            };
        }
        case GridCellKind.Drilldown:
        case GridCellKind.Bubble: {
            return {
                ...cell,
                data: [],
            };
        }
        case GridCellKind.Uri:
        case GridCellKind.Markdown: {
            return {
                ...cell,
                data: "",
            };
        }
        case GridCellKind.Text: {
            return {
                ...cell,
                data: "",
                displayData: "",
            };
        }
        case GridCellKind.Number: {
            return {
                ...cell,
                data: 0,
                displayData: "",
            };
        }
    }
    return cell;
}
