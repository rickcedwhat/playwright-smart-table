import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** List documentation sources, excluding VitePress caches and build output. */
export function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.')) return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(file) : entry.name.endsWith('.md') ? [file] : [];
  });
}

/** Validate native snippet tokens before VitePress can fall back to the whole file. */
export function validateDocSnippets(md) {
  md.core.ruler.after('block', 'validate-doc-snippets', state => {
    for (const token of state.tokens) {
      if (!token.src) continue;
      const [source, name] = token.src;
      const location = `${state.env.path ?? state.env.realPath}:${(token.map?.[0] ?? 0) + 1}`;
      try {
        if (!name) throw new Error('snippet imports must select a named region');
        const lines = readFileSync(source, 'utf8').split(/\r?\n/);
        const starts = [];
        const ends = [];
        lines.forEach((line, index) => {
          if (line.trim() === `// #region ${name}`) starts.push(index);
          if (line.trim() === `// #endregion ${name}`) ends.push(index);
        });
        if (starts.length !== 1 || ends.length !== 1 || ends[0] <= starts[0] ||
            !lines.slice(starts[0] + 1, ends[0]).join('\n').trim()) {
          throw new Error(`region '${name}' must have one ordered, nonempty start/end pair`);
        }
      } catch (error) {
        throw new Error(`${location}: ${source} — ${error.message}`);
      }
    }
  });
}

/** Parse with VitePress so imports, literal fences, and indentation match rendering. */
export function snippetImports(md, file) {
  return md.parse(readFileSync(file, 'utf8'), { path: file })
    .filter(token => token.src)
    .map(token => ({ source: token.src[0], region: token.src[1] }));
}

/** Include both directly edited pages and pages importing an edited snippet source. */
export function changedDocPages(md, docs, changed) {
  return markdownFiles(docs)
    .filter(file => changed.has(file) || snippetImports(md, file).some(({ source }) => changed.has(source)))
    .map(file => path.relative(docs, file).split(path.sep).join('/')
      .replace(/\.md$/, '').replace(/^index$/, ''))
    .sort();
}
