# Playground Configuration Design V4

## Objective
Design a robust, JSON-serializable configuration structure for the `playwright-smart-table` playground. This configuration will drive the `VirtualizedTable` component, allowing for:
- Granular control over row and cell data.
- Simulation of loading states (delays, infinite loading).
- Data generation patterns.
- Specific row and cell overrides by index/column.
- **Randomized delays ("stutter")** for realistic network simulation.

## Proposed TypeScript Interface

```typescript
/**
 * Represents a time duration in milliseconds.
 * - number: Fixed delay (e.g., 500).
 * - object: Randomized delay with a base and +/- deviation.
 *   (e.g., { base: 200, stutter: 50 } => 150-250ms).
 */
export type Delay = number | { base: number; stutter: number };

export interface PlaygroundConfig {
  /** 
   * Total number of rows to render.
   */
  rowCount: number;

  /**
   * Default settings applied to all rows/cells unless overridden.
   */
  defaults: {
    /** Global delay for the entire table to appear. */
    tableInitDelay: Delay;
    
    /** Base loading delay for rows. */
    rowDelay: Delay;
    
    /** Base loading delay for individual cells data to appear after row is present. */
    cellDelay: Delay;
    
    /** 
     * Default data generator to use. 
     * - `string`: Name of a registered generator (e.g., 'users').
     * - `function`: Direct function (e.g., `(index) => ({ id: index })`).
     *   *Note: Functions cannot be used in the JSON text editor.*
     */
    generator: string | ((index: number) => any);
  };

  /**
   * Specific overrides for individual rows, keyed by row index.
   */
  rows?: Record<number, RowConfig>;
}

export interface RowConfig {
  /**
   * Delay override for this specific row.
   */
  delay?: Delay;

  /**
   * The data source for this row.
   * - If omitted, uses the default generator.
   * - If object, uses this static data.
   * - If function, calls it with index.
   * - If string, uses that named generator.
   */
  data?: Record<string, any> | string | ((index: number) => any);

  /**
   * Specific overrides for cells within this row, keyed by Column ID.
   */
  cells?: Record<string, CellConfig>;
}

export interface CellConfig {
  /**
   * Delay override for this specific cell.
   */
  delay?: Delay;

  /**
   * The value for this cell. 
   */
  value?: any;
}
```

## JSON Examples

### Scenario 1: Realistic Network Jitter
Rows load with a base delay of 200ms, but with +/- 100ms jitter (100ms - 300ms).
```json
{
  "rowCount": 100,
  "defaults": { 
    "tableInitDelay": 500, 
    "rowDelay": { "base": 200, "stutter": 100 }, 
    "cellDelay": 0,
    "generator": "users" 
  }
}
```

### Scenario 2: Mixed Loading States
Row 5 is stuck loading. Row 6 takes exactly 5 seconds.
```json
{
  "rowCount": 100,
  "defaults": { "tableInitDelay": 0, "rowDelay": 200, "generator": "users" },
  "rows": {
    "5": { "delay": -1 }, 
    "6": { "delay": 5000 }
  }
}
```

### Scenario 3: Cell-Level "Pop-in"
Row 0 loads instantly, but the "status" cell takes 3 seconds to resolve.
```json
{
  "rowCount": 10,
  "defaults": { "tableInitDelay": 0, "rowDelay": 0, "cellDelay": 0, "generator": "users" },
  "rows": {
    "0": {
      "delay": 0,
      "cells": {
        "status": {
          "delay": 3000,
          "value": "Active"
        }
      }
    }
  }
}
```

## Data Generators

The `generator` property is a **string key** that tells the Playground how to manufacture data for a row if no static `data` is provided.

It maps to a registry of functions:

```typescript
const GENERATORS: Record<string, (index: number) => object> = {
  // Generates a realistic user object
  'users': (index) => ({
    id: index,
    name: `User ${index}`,
    email: `user${index}@example.com`,
    role: index % 3 === 0 ? 'Admin' : 'Viewer',
    status: index % 5 === 0 ? 'Inactive' : 'Active'
  }),

  // Generates a simple key-value pair for basic tests
  'simple': (index) => ({
    id: index,
    value: `Item ${index}`
  })
};
```

- **`defaults.generator`**: controlled by the dropdown in the UI. Sets the theme for the whole table.
- **`rows[i].data`**: Can be set to a generator string (e.g. `'simple'`) to switch the schema for just that row, or a raw object to override it entirely.
