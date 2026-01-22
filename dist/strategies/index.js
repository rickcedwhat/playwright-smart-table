"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Strategies = void 0;
const pagination_1 = require("./pagination");
const sorting_1 = require("./sorting");
const columns_1 = require("./columns");
const headers_1 = require("./headers");
const fill_1 = require("./fill");
const resolution_1 = require("./resolution");
__exportStar(require("./pagination"), exports);
__exportStar(require("./sorting"), exports);
__exportStar(require("./columns"), exports);
__exportStar(require("./headers"), exports);
__exportStar(require("./fill"), exports);
__exportStar(require("./resolution"), exports);
exports.Strategies = {
    Pagination: pagination_1.PaginationStrategies,
    Sorting: sorting_1.SortingStrategies,
    CellNavigation: columns_1.CellNavigationStrategies,
    Header: headers_1.HeaderStrategies,
    Fill: fill_1.FillStrategies,
    Resolution: resolution_1.ResolutionStrategies,
};
