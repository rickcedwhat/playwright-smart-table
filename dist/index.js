"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Plugins = exports.Strategies = exports.useTable = void 0;
var useTable_1 = require("./useTable");
Object.defineProperty(exports, "useTable", { enumerable: true, get: function () { return useTable_1.useTable; } });
// Export namespace-like strategy collections
var strategies_1 = require("./strategies");
Object.defineProperty(exports, "Strategies", { enumerable: true, get: function () { return strategies_1.Strategies; } });
var plugins_1 = require("./plugins");
Object.defineProperty(exports, "Plugins", { enumerable: true, get: function () { return plugins_1.Plugins; } });
