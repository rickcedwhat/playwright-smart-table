/**
 * #428 — Plugins shim stays until v7; assert shape parity with presets.
 */
import { describe, it, expect } from 'vitest';
import { Plugins, presets, Strategies } from '../../src/index';

describe('Plugins alias parity (#428)', () => {
    it('Plugins.RDG matches presets.rdg (plus Strategies alias)', () => {
        const { Strategies: _s, ...pluginRest } = Plugins.RDG as any;
        const { Strategies: _ps, ...presetRest } = presets.rdg as any;
        expect(pluginRest).toEqual(presetRest);
        expect(Plugins.RDG.Strategies).toBe(presets.rdg.Strategies);
    });

    it('Plugins.Glide matches presets.glide (plus Strategies alias)', () => {
        const { Strategies: _s, ...pluginRest } = Plugins.Glide as any;
        const { Strategies: _ps, ...presetRest } = presets.glide as any;
        expect(pluginRest).toEqual(presetRest);
        expect(Plugins.Glide.Strategies).toBe(presets.glide.Strategies);
    });

    it('Plugins.MUI matches presets.muiDataGrid (DataGrid only)', () => {
        const { Strategies: pluginStrategies, ...pluginRest } = Plugins.MUI as any;
        expect(pluginRest).toEqual(presets.muiDataGrid);
        expect(pluginStrategies).toBe(presets.muiDataGrid.strategies);
        // Sanity: MUI Table is a different preset
        expect(presets.muiTable).not.toEqual(presets.muiDataGrid);
    });
});

describe('Strategies namespace hygiene (#428)', () => {
    it('does not expose dead CellNavigation / Resolution or Filter.spy', () => {
        expect(Strategies).not.toHaveProperty('CellNavigation');
        expect(Strategies).not.toHaveProperty('Resolution');
        expect(Strategies.Filter).not.toHaveProperty('spy');
        expect(Strategies.Filter).toHaveProperty('default');
    });
});
