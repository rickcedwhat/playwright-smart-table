"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolutionStrategies = void 0;
exports.ResolutionStrategies = {
    default: {
        resolveIndex: ({ query, headerMap }) => {
            // 1. Exact / String Match
            if (typeof query === 'string') {
                if (headerMap.has(query))
                    return headerMap.get(query);
            }
            // 2. Regex Match
            if (query instanceof RegExp) {
                for (const [colName, idx] of headerMap.entries()) {
                    if (query.test(colName))
                        return idx;
                }
                return undefined;
            }
            // 3. (Optional) Fuzzy String Match fallback could go here
            // But for strict default strategy, we might want to keep it simple first
            // The original code didn't do fuzzy *resolution* logic inside the get(), it just did strict get().
            // The fuzzy logic was only for *suggestions* on error.
            return undefined;
        },
        resolveName: ({ query }) => {
            return query.toString();
        }
    }
};
