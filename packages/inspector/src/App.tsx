import { useEffect, useRef, useState } from 'react';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport, StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { Observation, SessionInfo, EvaluationResult } from '../../mcp/src/contracts';

const fixtures = {
  'mui-datagrid': { label: 'MUI-shaped baseline', path: 'mui-datagrid', oracle: '' },
  plain: { label: 'Plain table', path: 'plain', oracle: 'plain' },
  paginated: { label: 'Paginated table', path: 'paginated', oracle: 'paginated' },
  later: { label: 'Paginated: start on page 2', path: 'paginated?page=1', oracle: 'paginated' },
  broken: { label: 'Broken Next button', path: 'broken-next', oracle: 'broken-next' },
};

export default function App() {
  const [client, setClient] = useState<Client>();
  const [tools, setTools] = useState<Tool[]>([]);
  const [fixture, setFixture] = useState<keyof typeof fixtures>('mui-datagrid');
  const [url, setUrl] = useState('http://127.0.0.1:3001/fixtures/mui-datagrid');
  const [selector, setSelector] = useState('');
  const [observation, setObservation] = useState<Observation>();
  const [session, setSession] = useState<SessionInfo>();
  const owned = useRef<SessionInfo | undefined>(undefined);
  const requestedUrl = useRef('');
  const [report, setReport] = useState('');
  const [evaluation, setEvaluation] = useState<EvaluationResult>();
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const cancel = useRef<AbortController | undefined>(undefined);
  const evaluationVersion = useRef(0);
  function clearEvaluation() { evaluationVersion.current++; setEvaluation(undefined); }
  useEffect(() => {
    const connection = new Client({ name: 'smart-table-inspector-ui', version: '0.1.0' });
    const transport = new StreamableHTTPClientTransport(new URL('/mcp', window.location.origin));
    let mounted = true;
    void (async () => {
      try {
        await connection.connect(transport);
        const result = await connection.listTools();
        if (mounted) { setTools(result.tools); setClient(connection); }
      } catch (e) { if (mounted) setError(String(e)); }
    })();
    return () => { mounted = false; cancel.current?.abort(); void transport.terminateSession().catch(() => undefined).finally(() => connection.close()); };
  }, []);
  async function call(name: string, args: Record<string, unknown>, signal?: AbortSignal) {
    if (!client) throw new Error('MCP is disconnected');
    let result;
    try { result = await client.callTool({ name, arguments: args }, undefined, { signal }); }
    catch (error) {
      if (error instanceof StreamableHTTPError && error.code === 404) {
        setClient(undefined); throw new Error('MCP connection expired. Reload the bench to reconnect.');
      }
      throw error;
    }
    if (result.isError) {
      const text = Array.isArray(result.content) ? result.content.filter(item => item.type === 'text').map(item => item.text).join('\n') : 'Tool failed';
      let message = text;
      try { const value = JSON.parse(text); if (typeof value.message === 'string') message = `${value.code}: ${value.message}`; } catch { /* SDK validation errors can be plain text. */ }
      throw new Error(message);
    }
    return result.structuredContent as Record<string, unknown>;
  }
  async function closeSession() {
    const id = owned.current?.id;
    owned.current = undefined; requestedUrl.current = ''; setSession(undefined); setObservation(undefined); setReport(''); clearEvaluation();
    if (id) await call('close_session', { sessionId: id });
  }
  async function run() {
    if (!client) return;
    setRunning(true); setError(''); setObservation(undefined); clearEvaluation(); setReport('');
    const controller = new AbortController(); cancel.current = controller;
    try {
      if (owned.current && requestedUrl.current !== url) await closeSession();
      if (!owned.current) {
        const opened = await call('open_session', { url }, controller.signal) as unknown as SessionInfo;
        owned.current = opened; requestedUrl.current = url; setSession(opened);
      }
      const value = await call('inspect_table', { sessionId: owned.current.id, ...(selector ? { tableSelector: selector } : {}) }, controller.signal) as unknown as Observation;
      setObservation(value); setSession(value.session);
      setReport(JSON.stringify({ records: value.records, claim: 'partial', navigation: [] }, null, 2));
    } catch (e) {
      setError(String(e));
      // Always discard a failed handle; cancellation/timeout can close its browser.
      const old = owned.current; owned.current = undefined; setSession(undefined);
      if (old) await call('close_session', { sessionId: old.id }).catch(() => undefined);
    } finally { setRunning(false); cancel.current = undefined; }
  }
  async function compare() {
    const version = ++evaluationVersion.current;
    setError('');
    try {
      const response = await fetch('/bench/evaluate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fixture: fixtures[fixture].oracle, submission: JSON.parse(report) }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error);
      if (version === evaluationVersion.current) setEvaluation(value);
    } catch (e) { if (version === evaluationVersion.current) setError(String(e)); }
  }
  return <div className="bench">
    <aside>
      <h1>Smart Table Inspector</h1>
      <p className="status">{client ? 'Connected' : 'Disconnected'}</p>
      <h2>Inspection bench</h2>
      <p>Observe evidence in an owned browser session. Compare fixture data separately.</p>
      <form onSubmit={event => { event.preventDefault(); void run(); }}>
        <label>Fixture<select aria-label="Fixture" value={fixture} disabled={running} onChange={event => {
          const value = event.target.value as keyof typeof fixtures;
          setFixture(value); setUrl('http://127.0.0.1:3001/fixtures/' + fixtures[value].path);
          setObservation(undefined); setReport(''); clearEvaluation();
        }}>{Object.entries(fixtures).map(([id, value]) => <option key={id} value={id}>{value.label}</option>)}</select></label>
        <label>Target URL<input type="url" required disabled={running} value={url} onChange={event => { setUrl(event.target.value); setObservation(undefined); clearEvaluation(); setReport(''); }} /></label>
        <label>Table selector<input disabled={running} value={selector} placeholder="Automatic: one table or grid" onChange={event => setSelector(event.target.value)} /></label>
        <button disabled={!client || running}>{running ? 'Inspecting…' : 'Run inspection'}</button>
      </form>
      {running && <button type="button" onClick={() => cancel.current?.abort()}>Cancel inspection</button>}
      {session && <><p>Browser session open · observation {session.revision}</p><button type="button" disabled={running} onClick={() => { void closeSession().catch(e => setError(String(e))); }}>Close browser session</button></>}
      <h2>Available tools</h2>
      {tools.map(tool => <p key={tool.name}><strong>{tool.name}</strong><br />{tool.description}</p>)}
      <p className="note">Milestone 1 · No model calls or config execution</p>
    </aside>
    <main>
      <header><h2>Findings</h2><span>Raw MCP response</span></header>
      {error && <div role="alert">{error}</div>}
      {observation ? <pre aria-label="Inspection findings">{JSON.stringify(observation, null, 2)}</pre> : <p className="intro">Inspect a fixture or your own table. Mounted DOM is not proof of full traversal.</p>}
      {observation && fixtures[fixture].oracle && <section>
        <h2>Fixture comparison</h2>
        <p>The answer key is held by the bench, outside the MCP tool surface. This compares submitted data; it does not validate a config or prove complete traversal. You can edit the submission to test missing rows, incorrect values or unsupported claims.</p>
        <label>Evaluation submission<textarea value={report} onChange={event => { setReport(event.target.value); clearEvaluation(); }} /></label>
        <button type="button" onClick={() => { void compare(); }}>Compare with fixture</button>
        {evaluation && <pre aria-label="Fixture evaluation">{JSON.stringify(evaluation, null, 2)}</pre>}
      </section>}
    </main>
  </div>;
}
