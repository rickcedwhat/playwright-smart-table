import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createMarkdownRenderer } from 'vitepress';
import { changedDocPages, docPageLinks, snippetImports, validateDocSnippets } from '../../scripts/doc-snippets.mjs';

const directory = mkdtempSync(path.join(os.tmpdir(), 'doc-snippets-'));
const docs = path.join(directory, 'docs');
const source = path.join(directory, 'example.ts');
const page = path.join(docs, 'examples.md');
const valid = '// #region example\nconst value = 1;\n// #endregion example\n';
let md;
before(async () => {
  mkdirSync(docs);
  md = await createMarkdownRenderer(docs, {
    highlight: code => code,
    config: md => md.use(validateDocSnippets),
  });
});
after(() => rmSync(directory, { recursive: true, force: true }));

/** Parse fixtures using the same VitePress parser and validation hook as docs:dev. */
function imports(markdown, code = valid) {
  writeFileSync(source, code);
  writeFileSync(page, markdown);
  return snippetImports(md, page);
}

test('recognizes native imports, including indentation and language attributes', () => {
  assert.deepEqual(imports('  <<< ../example.ts#example{ts}\n'), [{ source, region: 'example' }]);
});

test('ignores fenced literals with zero to three spaces of indentation', () => {
  for (const indent of ['', ' ', '  ', '   ']) {
    assert.deepEqual(imports(`${indent}\`\`\`md\n<<< ../missing.ts#example\n${indent}\`\`\`\n`), []);
  }
});

test('an indented literal fence cannot hide a later invalid import', () => {
  for (const fence of ['    ```', '    ~~~', '\t```']) {
    assert.throws(() => imports(`${fence}\n\n<<< ../example.ts#missing\n`), /region 'missing'/);
  }
});

test('a fence with trailing content cannot close a fenced block', () => {
  assert.deepEqual(imports('```md\n```not-a-close\n<<< ../missing.ts#example\n```\n'), []);
});

test('missing source, region, or region selector is rejected', () => {
  assert.throws(() => imports('<<< ../missing.ts#example\n'), /ENOENT/);
  assert.throws(() => imports('<<< ../example.ts#missing\n'), /region 'missing'/);
  assert.throws(() => imports('<<< ../example.ts\n'), /must select a named region/);
});

test('duplicate, reversed, and blank region markers are rejected', () => {
  for (const code of [valid + valid, '// #endregion example\nvalue\n// #region example',
    '// #region example\n   \n// #endregion example']) {
    assert.throws(() => imports('<<< ../example.ts#example\n', code), /one ordered, nonempty/);
  }
});

test('re-parsing after a source edit rejects broken regions and recovers after repair', () => {
  imports('<<< ../example.ts#example\n');
  writeFileSync(source, valid.replace('#region example', '#region renamed'));
  assert.throws(() => snippetImports(md, page), /one ordered, nonempty/);
  writeFileSync(source, valid);
  assert.equal(snippetImports(md, page).length, 1);
});

test('changed pages include snippet consumers and direct edits without unrelated pages', () => {
  imports('<<< ../example.ts#example\n');
  const home = path.join(docs, 'index.md');
  const unrelated = path.join(docs, 'unrelated.md');
  writeFileSync(home, '# Home');
  writeFileSync(unrelated, '# Unrelated');
  assert.deepEqual(changedDocPages(md, docs, new Set([source])), ['examples.html']);
  assert.deepEqual(changedDocPages(md, docs, new Set([source, page, home])), ['', 'examples.html']);
  assert.deepEqual(changedDocPages(md, docs, new Set([unrelated])), ['unrelated.html']);
  assert.deepEqual(changedDocPages(md, docs, new Set([path.join(directory, 'other.ts')])), []);
});

test('nested indexes and home-only edits survive JSON transport and produce real page links', () => {
  const nested = path.join(docs, 'examples', 'index.md');
  mkdirSync(path.dirname(nested));
  writeFileSync(nested, '<<< ../../example.ts#example\n');
  writeFileSync(page, '# No snippet here');
  const routes = JSON.parse(JSON.stringify(changedDocPages(md, docs, new Set([source]))));
  assert.deepEqual(routes, ['examples/']);
  const canonical = 'https://example.com/library/';
  const preview = canonical + 'pr-preview/pr-544/';
  const compare = preview + 'compare.html';
  assert.deepEqual(docPageLinks(routes[0], canonical, preview, compare), {
    canonical: canonical + 'examples/', preview: preview + 'examples/', compare: compare + '#examples/',
  });
  const home = path.join(docs, 'index.md');
  const homeRoutes = JSON.parse(JSON.stringify(changedDocPages(md, docs, new Set([home]))));
  assert.deepEqual(homeRoutes, ['']);
  assert.equal(homeRoutes.length, 1);
  assert.deepEqual(docPageLinks(homeRoutes[0], canonical, preview, compare), {
    canonical, preview, compare: compare + '#',
  });
  assert.equal(docPageLinks('unrelated.html', canonical, preview, compare).preview, preview + 'unrelated.html');
});
