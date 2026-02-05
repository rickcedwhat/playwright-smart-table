"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Plugins = void 0;
const rdg_1 = require("./strategies/rdg");
const glide_1 = require("./strategies/glide");
exports.Plugins = {
    RDG: {
        Strategies: rdg_1.RDGStrategies
    },
    Glide: {
        Strategies: glide_1.GlideStrategies
    }
};
