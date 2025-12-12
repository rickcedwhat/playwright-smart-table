"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useMenu = exports.useForm = void 0;
const useTable_1 = require("./useTable");
/**
 * Preset for Key-Value Forms.
 * * Default Structure:
 * - Row: div.form-group
 * - Cell: Direct children (> *)
 * - Columns: ['Label', 'Input']
 */
const useForm = (rootLocator, options = {}) => {
    return (0, useTable_1.useTable)(rootLocator, Object.assign({ 
        // Defaults:
        rowSelector: 'div.form-group', cellSelector: (row) => row.locator('> *'), headerSelector: null, columnNames: ['Label', 'Input'] }, options));
};
exports.useForm = useForm;
/**
 * Preset for Navigation Menus.
 * * Default Structure:
 * - Row: li
 * - Cell: null (The row IS the cell)
 * - Columns: ['Item']
 */
const useMenu = (menuLocator, options = {}) => {
    return (0, useTable_1.useTable)(menuLocator, Object.assign({ 
        // Defaults:
        rowSelector: 'li', cellSelector: null, headerSelector: null, columnNames: ['Item'] }, options));
};
exports.useMenu = useMenu;
