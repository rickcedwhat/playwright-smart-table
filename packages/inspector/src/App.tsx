import { CopyButton } from './CopyButton';
import { RawResult, Notice, SnapshotView, NavigationView, ValidationView, LabVerdict } from './WorkflowView';
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

const steps = [
  { id: 'inspect', title: 'Inspect', heading: 'Inspect the current view', description: 'See what is rendered before testing the table’s behavior.' },
  { id: 'config', title: 'Config', heading: 'Review the proposed config', description: 'A proposal describes structure and behavior. It has not been validated yet.' },
  { id: 'probe', title: 'Navigation', heading: 'Probe table navigation', description: 'Test movement, stopping and restoration within a bounded budget.' },
  { id: 'validate', title: 'Validate', heading: 'Validate the config', description: 'Execute the config and, for registered fixtures, compare the returned data independently.' },
  { id: 'lab', title: 'Scorer lab', heading: 'Experiment with submitted data', description: 'An optional scoring sandbox, separate from the executed config’s verdict.' },
] as const;
type Step = typeof steps[number]['id'];
type Operation = 'propose_config' | 'probe_pagination' | 'probe_virtualization' | 'inspect_virtualization' | 'validate_config';

export default function App() {
  const [client, setClient] = useState<Client>();
  const [tools, setTools] = useState<Tool[]>([]);
  const [fixture, setFixture] = useState<keyof typeof fixtures>('scrolled');
  const [url, setUrl] = useState(__MCP_ORIGIN__ + '/fixtures/recycling?start=8');
  const [selector, setSelector] = useState('');
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  useEffect(() => { const media = window.matchMedia('(max-width: 900px)'); const update = () => setCompact(media.matches); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  const [step, setStep] = useState<Step>('inspect');
  const [observation, setObservation] = useState<Observation>();
  const [session, setSession] = useState<SessionInfo>();
  const owned = useRef<SessionInfo | undefined>(undefined);
  const requestedUrl = useRef('');
  const [report, setReport] = useState('');
  const [evaluation, setEvaluation] = useState<EvaluationResult>();
  const [labBusy, setLabBusy] = useState(false);
  const [proposalText, setProposalText] = useState('');
  const [code, setCode] = useState('');
  const generatedProposal = useRef('');
  const [probe, setProbe] = useState<Record<string, unknown>>();
  const [virtualObservation, setVirtualObservation] = useState<Record<string, unknown>>();
  const [validation, setValidation] = useState<ValidationResult>();
  const [trusted, setTrusted] = useState<Record<string, unknown>>();
  const [error, setError] = useState<{ step: Step; message: string }>();
  const [busy, setBusy] = useState<{ step: Step; message: string }>();
  const cancel = useRef<AbortController | undefined>(undefined);
  const labVersion = useRef(0);
  const runVersion = useRef(0);
  const running = !!busy;
  const sessionCurrent = !!session && requestedUrl.current === url;
  function clearLab() { labVersion.current++; setEvaluation(undefined); }
  function clearValidation() { runVersion.current++; setValidation(undefined); setTrusted(undefined); }
  function resetResults() {
    clearValidation(); clearLab(); setObservation(undefined); setVirtualObservation(undefined);
    setProposalText(''); setCode(''); generatedProposal.current = ''; setProbe(undefined); setReport(''); setError(undefined);
  }
  function changeTarget() { resetResults(); setStep('inspect'); }
  useEffect(() => {
    const connection = new Client({ name: 'smart-table-inspector-ui', version: '0.1.0' });
    const transport = new StreamableHTTPClientTransport(new URL('/mcp', window.location.origin));
    let mounted = true;
    void (async () => {
      try {
        await connection.connect(transport);
        const result = await connection.listTools();
        if (mounted) { setTools(result.tools); setClient(connection); }
      } catch (e) { if (mounted) setError({ step: 'inspect', message: String(e) }); }
    })();
    return () => { mounted = false; cancel.current?.abort(); void transport.terminateSession().catch(() => undefined).finally(() => connection.close()); };
  }, []);
  async function call(name: string, args: Record<string, unknown>, signal?: AbortSignal) {
    if (!client) throw new Error('MCP is disconnected');
    let result;
    try { result = await client.callTool({ name, arguments: args }, undefined, { signal, timeout: 125000 }); }
    catch (e) {
      if (e instanceof StreamableHTTPError && e.code === 404) { setClient(undefined); throw new Error('MCP connection expired. Reload the bench to reconnect.'); }
      throw e;
    }
    if (result.isError) {
      const text = Array.isArray(result.content) ? result.content.filter(item => item.type === 'text').map(item => item.text).join('\n') : 'Tool failed';
      let message = text;
      try { const value = JSON.parse(text); if (typeof value.message === 'string') message = `${value.code}: ${value.message}`; } catch { /* Native validation can be plain text. */ }
      throw new Error(message);
    }
    return result.structuredContent as Record<string, unknown>;
  }
  async function releaseBrowser() {
    const id = owned.current?.id;
    owned.current = undefined; requestedUrl.current = ''; setSession(undefined);
    if (id) await call('close_session', { sessionId: id });
  }
  async function run() {
    if (!client || running) return;
    setStep('inspect'); resetResults(); setBusy({ step: 'inspect', message: 'Opening the browser…' });
    const controller = new AbortController(); cancel.current = controller;
    try {
      if (owned.current && requestedUrl.current !== url) await releaseBrowser();
      if (!owned.current) {
        const opened = await call('open_session', { url }, controller.signal) as unknown as SessionInfo;
        owned.current = opened; requestedUrl.current = url; setSession(opened);
      }
      setBusy({ step: 'inspect', message: 'Reading the current rows…' });
      const value = await call('inspect_table', { sessionId: owned.current.id, ...(selector ? { tableSelector: selector } : {}) }, controller.signal) as unknown as Observation;
      setObservation(value); setSession(value.session);
      setReport(JSON.stringify({ records: value.records, claim: 'partial', navigation: [] }, null, 2));
    } catch (e) {
      setError({ step: 'inspect', message: String(e) });
      await releaseBrowser().catch(() => undefined);
    } finally { setBusy(undefined); cancel.current = undefined; }
  }
  async function compare() {
    if (labBusy || running || !canCompare) return;
    const version = ++labVersion.current;
    setLabBusy(true); setError(undefined); setEvaluation(undefined);
    try {
      const response = await fetch('/bench/evaluate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fixture: fixtures[fixture].oracle, submission: JSON.parse(report) }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error);
      if (version === labVersion.current) setEvaluation(value);
    } catch (e) { if (version === labVersion.current) setError({ step: 'lab', message: String(e) }); }
    finally { setLabBusy(false); }
  }
  async function workflow(name: Operation) {
    if (!owned.current || !sessionCurrent || running) return;
    const operationStep: Step = name === 'propose_config' ? 'config' : name === 'inspect_virtualization' ? 'inspect' : name === 'validate_config' ? 'validate' : 'probe';
    setStep(operationStep); setError(undefined); clearValidation();
    if (name === 'inspect_virtualization') setVirtualObservation(undefined);
    if (name === 'propose_config' || name === 'inspect_virtualization') { setProposalText(''); setCode(''); generatedProposal.current = ''; setProbe(undefined); }
    if (operationStep === 'probe') setProbe(undefined);
    setBusy({ step: operationStep, message: ({ inspect: 'Investigating the grid…', config: 'Preparing a proposal…', probe: 'Testing navigation…', validate: 'Compiling and running the config…', lab: '' })[operationStep] });
    const controller = new AbortController(); cancel.current = controller;
    const version = runVersion.current;
    try {
      const args = { sessionId: owned.current.id, ...(name === 'propose_config' || name === 'inspect_virtualization' ? (selector ? { tableSelector: selector } : {}) : { proposal: JSON.parse(proposalText) }) };
      const virtual = 'proposal' in args && !!(args.proposal as { virtualization?: unknown }).virtualization;
      const result = await call(name, { ...args, ...(virtual ? { budget: { maxPages: 10, maxActions: 20 } } : {}) }, controller.signal);
      if (name === 'inspect_virtualization') { setVirtualObservation(result); setSession(result.session as SessionInfo); }
      if (name === 'propose_config') { generatedProposal.current = JSON.stringify(result.proposal, null, 2); setProposalText(generatedProposal.current); setCode(String(result.code)); setSession(result.session as SessionInfo); }
      if (operationStep === 'probe') { setProbe(result); setSession(result.session as SessionInfo); }
      if (name === 'validate_config') {
        const value = result as unknown as ValidationResult; setValidation(value);
        if (fixtures[fixture].oracle && url === benchmarkUrl && matchesFixture(value.sourceUrl)) {
          setBusy({ step: 'validate', message: 'Comparing with the independent fixture answer key…' });
          const response = await fetch('/bench/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ runId: value.runId, fixture: fixtures[fixture].oracle }), signal: controller.signal });
          const comparison = await response.json();
          if (!response.ok) throw new Error(comparison.error);
          if (version === runVersion.current) setTrusted(comparison);
        }
      }
    } catch (e) {
      setError({ step: operationStep, message: String(e) });
      if (/TIME_BUDGET|CANCELLED|STALE_SESSION|abort/i.test(String(e))) await releaseBrowser().catch(() => undefined);
    } finally { setBusy(undefined); cancel.current = undefined; }
  }
  const benchmarkUrl = __MCP_ORIGIN__ + '/fixtures/' + fixtures[fixture].path;
  function matchesFixture(source: string) {
    const actual = new URL(source), expected = new URL(benchmarkUrl);
    return actual.origin === expected.origin && actual.pathname === expected.pathname && (actual.searchParams.get('page') ?? '0') === (expected.searchParams.get('page') ?? '0') && (actual.searchParams.get('start') ?? '0') === (expected.searchParams.get('start') ?? '0') && [...actual.searchParams.keys()].every(key => key === 'page' || key === 'start');
  }
  const canCompare = !!observation && !!fixtures[fixture].oracle && url === benchmarkUrl && matchesFixture(observation.evidence.url);
  const verified = trusted?.configValidated === true && trusted.passes === true;
  const overall = verified ? 'Fixture verified' : error && error.step !== 'lab' ? 'Needs attention' : validation?.status === 'partial' ? 'Partial run' : trusted || validation?.status === 'failed' ? 'Needs attention' : validation ? 'Runtime checked' : 'Not validated yet';
  function stepStatus(id: Step) {
    if (busy?.step === id) return 'Working…';
    if (error?.step === id) return 'Needs attention';
    if (id === 'inspect') return observation ? 'Snapshot ready' : 'Not run';
    if (id === 'config') return verified ? 'Fixture verified' : proposalText ? 'Proposal ready' : 'Not run';
    if (id === 'probe') return probe ? probe.status === 'tested' ? 'Checked' : probe.status === 'partial' ? 'Partial' : 'Needs attention' : 'Not run';
    if (id === 'validate') return verified ? 'Fixture verified' : validation ? validation.status === 'tested' ? 'Runtime checked' : String(validation.status) : 'Not run';
    return 'Optional · data only';
  }
  const current = steps.find(item => item.id === step)!;
  const canPropose = !!observation && sessionCurrent && !running;
  const canExecute = !!proposalText.trim() && sessionCurrent && !running;
  return <div className="bench">
    <aside>
      <div className="brand"><span className="brand-mark">ST</span><div><h1>Smart Table</h1><span>Inspection bench</span></div></div>
      <p className={`connection ${client ? 'connected' : ''}`}><span />{client ? 'Connected' : 'Disconnected'}</p>
      <div className="target-settings">
        <label>Fixture<select aria-label="Fixture" value={fixture} disabled={running} onChange={event => { const value = event.target.value as keyof typeof fixtures; setFixture(value); setUrl(__MCP_ORIGIN__ + '/fixtures/' + fixtures[value].path); changeTarget(); }}>{Object.entries(fixtures).map(([id, value]) => <option key={id} value={id}>{value.label}</option>)}</select></label>
        <details className="target-advanced"><summary>URL & selector</summary>
        <label>Target URL<input type="url" required disabled={running} value={url} onChange={event => { setUrl(event.target.value); changeTarget(); }} /></label>
        <label>Table selector <span className="optional">optional</span><input aria-label="Table selector" disabled={running} value={selector} placeholder="Automatic: one table or grid" onChange={event => { setSelector(event.target.value); changeTarget(); }} /></label>
        {url !== benchmarkUrl && <p>Custom target · no fixture answer key.</p>}
        </details>
      </div>
      <div className="workflow-label">Workflow</div>
      <nav role="tablist" aria-label="Workflow steps" aria-orientation={compact ? 'horizontal' : 'vertical'} onKeyDown={event => {
        const forward = compact ? 'ArrowRight' : 'ArrowDown', backward = compact ? 'ArrowLeft' : 'ArrowUp';
        if (![forward, backward, 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); const focused = (event.target as HTMLElement).closest('[role=tab]')?.id;
        const index = steps.findIndex(item => 'tab-' + item.id === focused);
        if (index < 0) return;
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? steps.length - 1 : (index + (event.key === forward ? 1 : -1) + steps.length) % steps.length;
        setStep(steps[next].id); document.getElementById('tab-' + steps[next].id)?.focus();
      }}>{steps.map((item, index) => <button key={item.id} role="tab" id={'tab-' + item.id} aria-label={item.title} aria-selected={step === item.id} aria-controls={'panel-' + item.id} tabIndex={step === item.id ? 0 : -1} className={`step-tab ${item.id === 'lab' ? 'lab-tab' : ''}`} onClick={() => setStep(item.id)}><span className="step-number">{item.id === 'lab' ? '↗' : index + 1}</span><span><strong>{item.title}</strong><small>{stepStatus(item.id)}</small></span>{step === item.id && <span className="step-arrow" aria-hidden="true">›</span>}</button>)}</nav>
      <div className="step-actions">
        {step === 'inspect' && <><button className="primary" disabled={!client || running || !url} onClick={() => { void run(); }}>Run inspection</button><p>Reinspection starts a new result set.</p>{observation && sessionCurrent && <><button className="secondary" disabled={running} onClick={() => { void workflow('inspect_virtualization'); }}>Inspect virtualization</button><p>Optional investigation for grids with recycled rows. Clears later steps.</p><button className="text-button" disabled={running} onClick={() => setStep('config')}>Continue to config →</button></>}</>}
        {step === 'config' && <><button className="primary" disabled={!canPropose} onClick={() => { void workflow('propose_config'); }}>Propose config</button><p>{canPropose ? 'Generate a proposal from the current table state.' : 'Inspect the target in an open browser first.'}</p>{proposalText && <button className="text-button" disabled={running} onClick={() => setStep('probe')}>Continue to navigation →</button>}</>}
        {step === 'probe' && <><button className="primary" disabled={!canExecute} onClick={() => { try { void workflow(JSON.parse(proposalText).virtualization ? 'probe_virtualization' : 'probe_pagination'); } catch (e) { setError({ step: 'probe', message: String(e) }); } }}>Probe navigation</button><p>{canExecute ? 'Test movement and attempt to restore the starting view.' : 'A proposal and an open browser are required.'}</p>{proposalText && <button className="text-button" disabled={running} onClick={() => setStep('validate')}>Continue to validation →</button>}</>}
        {step === 'validate' && <><button className="primary" disabled={!canExecute} onClick={() => { void workflow('validate_config'); }}>Validate config</button><p>{canExecute ? 'Run against an installed copy of the library; then check the fixture records.' : 'A proposal and an open browser are required. Probing first is recommended.'}</p></>}
        {step === 'lab' && <><button className="secondary" disabled={!canCompare || running || labBusy} onClick={() => { void compare(); }}>Compare with fixture</button><p>{labBusy ? 'Comparing submitted data…' : canCompare ? 'Compare only the editable submission on the right.' : 'Inspect a registered fixture to enable this scoring experiment.'}</p></>}
        {busy && <div className="working" role="status"><span className="spinner" />{busy.message}</div>}
        {running && <button className="text-button" onClick={() => cancel.current?.abort()}>Cancel operation</button>}
      </div>
      <details className="session-details"><summary>Session & tools</summary><p>{session ? `Browser open · revision ${session.revision}` : observation ? 'Browser closed · results retained' : 'No browser session'}</p>{session && <button className="secondary" disabled={running} onClick={() => { void releaseBrowser().catch(e => setError({ step, message: String(e) })); }}>Close browser session</button>}<ul>{tools.map(tool => <li key={tool.name}><strong>{tool.name}</strong><p>{tool.description}</p></li>)}</ul></details>
      <p className="model-note">Local bench · Model runs deferred</p>
    </aside>
    <main>
      <header className="page-header"><div><span className="eyebrow">Inspect → propose → test</span><h2>Understand the table. Verify the config.</h2></div><span role="status" aria-live="polite" aria-atomic="true" className={`verdict-badge ${verified ? 'success' : validation?.status === 'partial' ? 'warning' : trusted || validation?.status === 'failed' ? 'danger' : ''}`}>{busy ? 'Working…' : overall}</span></header>
      {error && <div role="alert"><CopyButton label="Error" text={error.message} /><strong>{steps.find(item => item.id === error.step)?.title}: </strong>{error.message}</div>}
      <section className="step-panel" role="tabpanel" aria-busy={busy?.step === step} id={'panel-' + step} aria-labelledby={'tab-' + step} tabIndex={0}>
        <div className="panel-heading"><span className="eyebrow">{step === 'lab' ? 'Optional experiment' : `Step ${steps.findIndex(item => item.id === step) + 1} of 4`}</span><h2>{current.heading}</h2><p>{current.description}</p></div>
        {step === 'inspect' && <SnapshotView observation={observation} virtual={virtualObservation} />}
        {step === 'config' && (proposalText ? <><Notice tone={verified ? 'success' : 'neutral'} title={verified ? 'This proposal passed the fixture check' : 'Proposal only · not validated'}><p>Editing this JSON clears navigation and validation results. Validation uses the edited JSON; generated code is retained from the original proposal.</p></Notice><label><span className="label-heading">Config proposal<CopyButton label="Config proposal" text={proposalText} /></span><textarea aria-label="Config proposal" disabled={running} value={proposalText} spellCheck={false} onChange={event => { setProposalText(event.target.value); setProbe(undefined); clearValidation(); setError(undefined); }} /></label><RawResult label={proposalText === generatedProposal.current ? "Generated config" : "Original generated config"} value={code} /></> : <div className="empty-state"><span className="empty-symbol">02</span><h3>Describe this table</h3><p>Inspect the target first, then propose a config using the action on the left.</p></div>)}
        {step === 'probe' && <NavigationView probe={probe} />}
        {step === 'validate' && <ValidationView validation={validation} trusted={trusted} comparing={busy?.step === 'validate' && !!validation} />}
        {step === 'lab' && <><Notice title="Data-only experiment · separate from the config run"><p>The submission starts with the initial rendered rows and never updates automatically after navigation or validation. Missing rows here are expected for a partial snapshot. Editing or comparing this data does not change the config verdict.</p></Notice>{canCompare ? <><label><span className="label-heading">Evaluation submission<CopyButton label="Evaluation submission" text={report} /></span><textarea aria-label="Evaluation submission" disabled={running} spellCheck={false} value={report} onChange={event => { setReport(event.target.value); clearLab(); if (error?.step === 'lab') setError(undefined); }} /></label><LabVerdict evaluation={evaluation} /></> : <div className="empty-state"><h3>No submission to compare</h3><p>Only registered fixtures have an independent answer key. Custom targets can have runtime checks without a fixture verdict.</p></div>}</>}
      </section>
    </main>
  </div>;
}
