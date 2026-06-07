export function truncate(val: string, max: number) {
  var res = val;
  if (val.length > max) {
    res = val.substring(0, max) + '...';
  }
  return res;
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function slugify(input: string) {
  var result = input.toLowerCase();
  result = result.replace(/ /g, '-');
  result = result.replace(/[^a-z0-9-]/g, '');
  return result;
}
