const cache = new Map();

export function memoize(fn: Function) {
  return function(...args: any[]) {
    var key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    var result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

export function clearCache() {
  cache.clear();
}

export function getCacheSize() {
  return cache.size;
}

export async function memoizeAsync(fn: Function) {
  return async function(...args: any[]) {
    var key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    var result = await fn(...args);
    cache.set(key, result);
    return result;
  };
}
