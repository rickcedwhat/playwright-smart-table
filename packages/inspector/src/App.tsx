import { CopyButton, ResultPanel } from './CopyButton';
import { useEffect, useRef, useState } from 'react';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport, StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ValidationResult } from '../../mcp/src/workflow-contracts';
import type { Observation, SessionInfo, EvaluationResult } from '../../mcp/src/contracts';

const fixtures = {
  'mui-datagrid': { label: 'MUI-shaped baseline', path: 'mui-datagrid', oracle: '' },
  plain: { label: 'Plain table', path: 'plain', oracle: 'plain' },
  paginated: { label: 'Paginated table', path: 'paginated', oracle: 'paginated' },
  later: { label: 'Paginated: start on page 2', path: 'paginated?page=1', oracle: 'paginated' },
  recycling: {label:'Recycling grid — stable IDs',path:'recycling',oracle:'recycling'},
  scrolled: {label:'Recycling grid — start at row 9',path:'recycling?start=8',oracle:'recycling'},
  ambiguous: {label:'Recycling grid — identical rows, no IDs',path:'recycling-no-id',oracle:'recycling-no-id'},
  delayed: {label:'Recycling grid — delayed readiness',path:'recycling-delayed',oracle:'recycling-delayed'},
  localIds: {label:'Recycling grid — reused IDs',path:'recycling-local-ids',oracle:'recycling-local-ids'},
  pinned: {label:'Recycling grid — duplicate headers',path:'recycling-pinned',oracle:'recycling-pinned'},
  offscreen: {label:'Recycling grid — off-screen column',path:'recycling-offscreen',oracle:'recycling-offscreen'},
  horizontal: {label:'Recycling grid — horizontal viewport',path:'recycling-horizontal',oracle:'recycling-horizontal'},
  changing: {label:'Recycling grid — changing dataset',path:'recycling-changing',oracle:'recycling-changing'},
  hostile: {label:'Recycling grid — hostile page text',path:'recycling-hostile',oracle:'recycling-hostile'},
  broken: { label: 'Broken Next button', path: 'broken-next', oracle: 'broken-next' },
};

export default function App() {
  const [client, setClient] = useState<Client>();
  const [tools, setTools] = useState<Tool[]>([]);
  const [fixture, setFixture] = useState<keyof typeof fixtures>('mui-datagrid');
  const [url, setUrl] = useState(__MCP_ORIGIN__ + '/fixtures/mui-datagrid');
  const [selector, setSelector] = useState('');
  const [observation, setObservation] = useState<Observation>();
  const [session, setSession] = useState<SessionInfo>();
  const owned = useRef<SessionInfo | undefined>(undefined);
  const requestedUrl = useRef('');
  const [report, setReport] = useState('');
  const [evaluation, setEvaluation] = useState<EvaluationResult>();
  const [proposalText, setProposalText] = useState('');
  const [code, setCode] = useState('');
  const [probe, setProbe] = useState<Record<string, unknown>>();
  const [virtualObservation, setVirtualObservation] = useState<Record<string,unknown>>();
  const [validation, setValidation] = useState<ValidationResult>();
  const [trusted, setTrusted] = useState<Record<string, unknown>>();
  function clearWorkflow() { setVirtualObservation(undefined); setProposalText(''); setCode(''); setProbe(undefined); setValidation(undefined); setTrusted(undefined); }
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const cancel = useRef<AbortController | undefined>(undefined);
  const evaluationVersion = useRef(0);
  function clearEvaluation() { evaluationVersion.current++; setEvaluation(undefined); setTrusted(undefined); }
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
    try { result = await client.callTool({ name, arguments: args }, undefined, { signal, timeout: 125000 }); }
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
    owned.current = undefined; requestedUrl.current = ''; setSession(undefined); setObservation(undefined); setReport(''); clearEvaluation(); clearWorkflow();
    if (id) await call('close_session', { sessionId: id });
  }
  async function run() {
    if (!client) return;
    setRunning(true); setError(''); setObservation(undefined); clearEvaluation(); clearWorkflow(); setReport('');
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
  async function workflow(name: 'propose_config' | 'probe_pagination' | 'probe_virtualization' | 'inspect_virtualization' | 'validate_config') {
    if (!owned.current) return;
    setRunning(true); setError(''); clearEvaluation(); setValidation(undefined);
    const controller = new AbortController(); cancel.current = controller;
    const version = evaluationVersion.current;
    try {
      const args = { sessionId: owned.current.id, ...(name === 'propose_config' || name === 'inspect_virtualization' ? (selector ? { tableSelector: selector } : {}) : { proposal: JSON.parse(proposalText) }) };
      const virtual = 'proposal' in args && !!(args.proposal as {virtualization?:unknown}).virtualization;
      const result = await call(name, {...args, ...(virtual ? {budget:{maxPages:10,maxActions:20}} : {})}, controller.signal);
      if(name === 'inspect_virtualization')setVirtualObservation(result);
      if (name === 'propose_config') { setProposalText(JSON.stringify(result.proposal, null, 2)); setCode(String(result.code)); setProbe(undefined); }
      if (name === 'probe_pagination' || name === 'probe_virtualization') { setProbe(result); setSession(result.session as SessionInfo); }
      if (name === 'validate_config') {
        const value = result as unknown as ValidationResult;
        setValidation(value);
        if (fixtures[fixture].oracle && url === benchmarkUrl && matchesFixture(value.sourceUrl)) {
          const response = await fetch('/bench/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ runId: value.runId, fixture: fixtures[fixture].oracle }), signal: controller.signal });
          const comparison = await response.json();
          if (!response.ok) throw new Error(comparison.error);
          if (version === evaluationVersion.current) setTrusted(comparison);
        }
      }
    } catch (e) {
      setError(String(e));
      if (/TIME_BUDGET|CANCELLED|STALE_SESSION|abort/i.test(String(e))) await closeSession().catch(() => undefined);
    }
    finally { setRunning(false); cancel.current = undefined; }
  }
  const benchmarkUrl = __MCP_ORIGIN__ + '/fixtures/' + fixtures[fixture].path;
  function matchesFixture(source: string) {
    const actual = new URL(source), expected = new URL(benchmarkUrl);
    return actual.origin === expected.origin && actual.pathname === expected.pathname && (actual.searchParams.get('page') ?? '0') === (expected.searchParams.get('page') ?? '0') && (actual.searchParams.get('start') ?? '0') === (expected.searchParams.get('start') ?? '0') && [...actual.searchParams.keys()].every(key => key === 'page' || key === 'start');
  }
  const canCompare = observation && fixtures[fixture].oracle && url === benchmarkUrl && matchesFixture(observation.evidence.url);
  return <div className="bench">
    <aside>
      <h1>Smart Table Inspector</h1>
      <p className="status">{client ? 'Connected' : 'Disconnected'}</p>
      <h2>Inspection bench</h2>
      <p>Observe evidence in an owned browser session. Compare fixture data separately.</p>
      <form onSubmit={event => { event.preventDefault(); void run(); }}>
        <label>Fixture<select aria-label="Fixture" value={fixture} disabled={running} onChange={event => {
          const value = event.target.value as keyof typeof fixtures;
          setFixture(value); setUrl(__MCP_ORIGIN__ + '/fixtures/' + fixtures[value].path);
          setObservation(undefined); setReport(''); clearEvaluation(); clearWorkflow();
        }}>{Object.entries(fixtures).map(([id, value]) => <option key={id} value={id}>{value.label}</option>)}</select></label>
        <label>Target URL<input type="url" required disabled={running} value={url} onChange={event => { setUrl(event.target.value); setObservation(undefined); clearEvaluation(); clearWorkflow(); setReport(''); }} /></label>
        <label>Table selector<input disabled={running} value={selector} placeholder="Automatic: one table or grid" onChange={event => { setSelector(event.target.value); setObservation(undefined); clearEvaluation(); clearWorkflow(); }} /></label>
        <button disabled={!client || running}>{running ? 'Inspecting…' : 'Run inspection'}</button>
      </form>
      {running && <button type="button" onClick={() => cancel.current?.abort()}>Cancel inspection</button>}
      {session && <><p>Browser session open · observation {session.revision}</p><button type="button" disabled={running} onClick={() => { void closeSession().catch(e => setError(String(e))); }}>Close browser session</button></>}
      <h2>Available tools</h2>
      {tools.map(tool => <p key={tool.name}><strong>{tool.name}</strong><br />{tool.description}</p>)}
      <p className="note">Milestone 3 · Native tables and vertical grids · Model runs deferred</p>
    </aside>
    <main>
      <header><h2>Findings</h2><span>Raw MCP response</span></header>
      {error && <div role="alert"><CopyButton label="Error" text={error} />{error}</div>}
      {observation ? <ResultPanel label="Inspection findings" text={JSON.stringify(observation, null, 2)} /> : <p className="intro">Inspect a fixture or your own table. Mounted DOM is not proof of full traversal.</p>}
      {session && requestedUrl.current === url && <section>
        <h2>Config workflow</h2>
        <p>Propose selectors, probe explicit navigation, then type-check and execute the config in a disposable consumer of the packed library. The original browser is unchanged by validation.</p>
        <button type="button" disabled={running} onClick={() => { void workflow('inspect_virtualization'); }}>Inspect virtualization</button>
        {virtualObservation && <ResultPanel label="Virtualization findings" text={JSON.stringify(virtualObservation,null,2)} />}
        <button type="button" disabled={running} onClick={() => { void workflow('propose_config'); }}>Propose config</button>
        {proposalText && <>
          <label><span className="label-heading">Config proposal<CopyButton label="Config proposal" text={proposalText} /></span><textarea aria-label="Config proposal" disabled={running} value={proposalText} onChange={event => { setProposalText(event.target.value); setProbe(undefined); setValidation(undefined); setTrusted(undefined); }} /></label>
          <p>The code below belongs to the original proposal. Edited JSON is compiled afresh during validation.</p>
          <ResultPanel label="Generated config" text={code} />
          <button type="button" disabled={running} onClick={() => { try { void workflow(JSON.parse(proposalText).virtualization ? 'probe_virtualization' : 'probe_pagination'); } catch(e) {setError(String(e));} }}>Probe navigation</button>
          <button type="button" disabled={running} onClick={() => { void workflow('validate_config'); }}>Validate config</button>
        </>}
        {probe && <ResultPanel label="Navigation probe" text={JSON.stringify(probe, null, 2)} />}
        {validation && <ResultPanel label="Config validation" text={JSON.stringify(validation, null, 2)} />}
        {trusted && <><h3>Independent fixture check</h3><ResultPanel label="Trusted fixture evaluation" text={JSON.stringify(trusted, null, 2)} /></>}
      </section>}
      {canCompare && <section>
        <h2>Fixture comparison</h2>
        <p>This editable submission starts with the initially mounted rows and does not update after validation. Use Independent fixture check above for the executed config. This comparison only checks submitted data; you can edit it to test missing rows, incorrect values or unsupported claims.</p>
        <label><span className="label-heading">Evaluation submission<CopyButton label="Evaluation submission" text={report} /></span><textarea aria-label="Evaluation submission" value={report} onChange={event => { setReport(event.target.value); clearEvaluation(); }} /></label>
        <button type="button" onClick={() => { void compare(); }}>Compare with fixture</button>
        {evaluation && <ResultPanel label="Fixture evaluation" text={JSON.stringify(evaluation, null, 2)} />}
      </section>}
    </main>
  </div>;
}
