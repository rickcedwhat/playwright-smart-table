// Replica of the "Add data" story (Glide-Data-Grid/DataEditor Demos) for hermetic PR CI (#474).
// Copied from glideapps/glide-data-grid (MIT): packages/core/src/docs/examples/add-data.stories.tsx
// Local changes: imports point at the published package / local utils, and the storybook
// decorator is applied directly in main.tsx.
import React from "react";
import { DataEditor } from "@glideapps/glide-data-grid";
import { useMockDataGenerator, defaultProps, clearCell } from "./utils.js";

export const AddData: React.VFC = () => {
    const { cols, getCellContent, setCellValueRaw, setCellValue } = useMockDataGenerator(60, false);

    const [numRows, setNumRows] = React.useState(50);

    const onRowAppended = React.useCallback(() => {
        const newRow = numRows;
        // our data source is a mock source that pre-fills data, so we are just clearing this here. You should not
        // need to do this.
        for (let c = 0; c < cols.length; c++) {
            const cell = getCellContent([c, newRow]);
            setCellValueRaw([c, newRow], clearCell(cell));
        }
        // Tell the data grid there is another row
        setNumRows(cv => cv + 1);
    }, [cols.length, getCellContent, numRows, setCellValueRaw]);

    return (
        <DataEditor
            {...defaultProps}
            getCellContent={getCellContent}
            columns={cols}
            rangeSelectionColumnSpanning={false}
            rowMarkers={"both"}
            onPaste={true} // we want to allow paste to just call onCellEdited
            onCellEdited={setCellValue} // Sets the mock cell content
            trailingRowOptions={{
                // How to get the trailing row to look right
                sticky: false,
                tint: true,
                hint: "New row...",
            }}
            rows={numRows}
            onRowAppended={onRowAppended}
        />
    );
};
