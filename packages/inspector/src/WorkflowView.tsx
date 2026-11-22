import type { ReactNode } from 'react';
import type { Observation, EvaluationResult } from '../../mcp/src/contracts';
import type { ValidationResult } from '../../mcp/src/workflow-contracts';
import { CopyButton, ResultPanel } from './CopyButton';

export function RawResult({ label, value }: { label: string; value: unknown }) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return <details className="raw-result"><summary><span>{label}</span><CopyButton label={label} text={text} /></summary><ResultPanel label={label} text={text} copy={false} /></details>;
}
export function Notice({ tone = 'neutral', title, children }: { tone?: 'neutral' | 'success' | 'warning' | 'danger'; title: string; children: ReactNode }) {
  return <div className={`notice ${tone}`}><strong>{title}</strong><div>{children}</div></div>;
}
export function SnapshotView({ observation, virtual }: { observation?: Observation; virtual?: Record<string, unknown> }) {
  if (!observation) return <div className="empty-state"><span className="empty-symbol">01</span><h3>Start with what is on screen</h3><p>Choose a target on the left and run an inspection. You’ll see the current rows and columns before testing navigation or a config.</p></div>;
  return <>
    <div className="metrics"><div><strong>{observation.mountedRowCount}</strong><span>Rows currently rendered</span></div><div><strong>{observation.declaredRowCount ?? 'Unknown'}</strong><span>Rows declared by the table</span></div><div><strong>{observation.headers.length}</strong><span>Observed columns</span></div></div>
    <Notice title="Initial snapshot only"><p>These are the rows rendered at inspection time. Navigation and validation come later; this snapshot does not establish the full dataset.</p></Notice>
    {observation.coverage.layoutUnsupported && <Notice tone="warning" title="Column layout needs investigation"><p>Values were withheld because the column mapping was ambiguous.</p></Notice>}
    {observation.records.length > 0 && <div className="row-preview"><table><caption>Initial rows · preview of up to five records</caption><thead><tr><th scope="col">ID candidate</th>{observation.headers.slice(0, 4).map(name => <th scope="col" key={name}>{name}</th>)}</tr></thead><tbody>{observation.records.slice(0, 5).map((row, index) => <tr key={index}><td>{row.id ?? 'Unknown'}</td>{observation.headers.slice(0, 4).map(name => <td key={name}>{row.values[name]}</td>)}</tr>)}</tbody></table></div>}
    <RawResult label="Inspection findings" value={observation} />
    {virtual && <><Notice tone={virtual.status === 'observed' ? 'neutral' : 'warning'} title={virtual.status === 'observed' ? 'Grid evidence recorded' : virtual.identity === 'unknown' ? 'Grid identity is unknown' : 'Grid investigation has limits'}><p>{virtual.status === 'observed' ? 'ID candidates and mounted-window metadata were observed. Navigation still needs testing.' : 'Review the reasons below before assuming the grid can be traversed. This optional investigation does not determine whether a native table config works.'}</p>{Array.isArray(virtual.reasons) && virtual.reasons.length > 0 && <ul>{virtual.reasons.map((reason, index) => <li key={index}>{String(reason)}</li>)}</ul>}</Notice><RawResult label="Virtualization findings" value={virtual} /></>}
  </>;
}
export function NavigationView({ probe }: { probe?: Record<string, unknown> }) {
  if (!probe) return <div className="empty-state"><span className="empty-symbol">03</span><h3>Check how the table moves</h3><p>Propose a config first, then probe its navigation. The probe attempts to restore the starting position using the same budget.</p></div>;
  const traversal = probe.traversal as { actions: number; pages: number; restoration: string; termination: string };
  const singlePage = traversal.termination === 'single-page';
  const tone = singlePage ? 'neutral' : probe.status === 'tested' ? 'success' : probe.status === 'partial' ? 'warning' : 'danger';
  return <><Notice tone={tone} title={singlePage ? 'Single-page observation recorded' : probe.status === 'tested' ? 'Navigation checked within the probe scope' : probe.status === 'partial' ? 'Navigation probe is partial' : 'Navigation needs attention'}><p>{singlePage ? 'No pagination or scrolling was configured. The probe observed this page only; it does not establish dataset completeness.' : probe.status === 'tested' ? 'Movement and stopping behavior were tested. This is not the config’s final validation result.' : `The probe stopped at “${traversal.termination.replaceAll('-', ' ')}”. Review the evidence before continuing.`}</p></Notice><div className="metrics"><div><strong>{traversal.actions}</strong><span>Action attempts</span></div><div><strong>{traversal.pages}</strong><span>Windows / pages observed</span></div><div><strong className="metric-word">{singlePage && traversal.restoration === 'not-attempted' ? 'Not needed' : traversal.restoration.replaceAll('-', ' ')}</strong><span>Starting-position restoration</span></div></div><RawResult label="Navigation probe" value={probe} /></>;
}
export function ValidationView({ validation, trusted, comparing }: { validation?: ValidationResult; trusted?: Record<string, unknown>; comparing: boolean }) {
  if (!validation) return <div className="empty-state"><span className="empty-symbol">04</span><h3>Does the config actually work?</h3><p>Validation compiles and runs the proposal using the packed library in a fresh browser. Registered fixtures also get an independent check of every expected record and value.</p></div>;
  const verified = trusted?.configValidated === true && trusted.passes === true;
  const tone = verified ? 'success' : validation.status === 'partial' ? 'warning' : trusted || validation.status === 'failed' ? 'danger' : 'warning';
  const title = comparing ? 'Checking the fixture answer key…' : verified ? 'Config passed this fixture' : validation.status === 'partial' ? 'Validation is incomplete' : trusted ? 'Config did not pass the fixture check' : validation.status === 'tested' ? 'Runtime checks passed · no independent verdict' : 'Config run failed';
  return <><Notice tone={comparing ? 'neutral' : tone} title={title}><p>{comparing ? 'The config ran. Its returned records are now being compared with the independent answer key.' : verified ? 'The executed config matched every expected ID, occurrence and value for this fixture. This is the verdict for this run.' : validation.status === 'partial' ? 'The run stopped before validation could finish. Review its budget or stopping reason below; this is not a verified pass.' : trusted ? 'The execution or its returned records did not satisfy the fixture check. Inspect the details below.' : validation.status === 'tested' ? 'Execution succeeded, but a registered fixture comparison has not confirmed exact membership and values. This is not a verified fixture pass.' : 'A partial or failed execution cannot validate the config. The diagnostic details explain where it stopped.'}</p></Notice>
    <div className="metrics"><div><strong>{validation.records.length}</strong><span>Records returned</span></div><div><strong>{Object.values(validation.checks).filter(Boolean).length} / 4</strong><span>Runtime checks passed</span></div><div><strong>{(validation.elapsedMs / 1000).toFixed(1)}s</strong><span>Validation runtime</span></div></div>
    <div className="check-list">{Object.entries(validation.checks).map(([name, passed]) => <div key={name}><span className={passed ? 'check-pass' : 'check-pending'}>{passed ? '✓' : '–'}</span><span>{({ init: 'Initialize the table', query: 'Query representative records', extraction: 'Extract row values', reset: 'Reset the table' })[name as keyof ValidationResult['checks']]}</span></div>)}</div>
    {validation.diagnostics.length > 0 && <Notice tone="warning" title="Run diagnostics"><ul>{validation.diagnostics.map((value, index) => <li key={index}>{value}</li>)}</ul></Notice>}
    <p className="scope-note">This verdict applies to this execution, packed build and fixture. It does not prove universal identity or completeness.</p>
    <RawResult label="Config validation" value={validation} />
    {trusted && <><h3>Independent fixture check</h3><RawResult label="Trusted fixture evaluation" value={trusted} /></>}
  </>;
}
export function LabVerdict({ evaluation }: { evaluation?: EvaluationResult }) {
  if (!evaluation) return null;
  return <><Notice tone="neutral" title={evaluation.dataMatches ? evaluation.passes ? 'Submitted data matches the answer key' : 'Data matches; claims need attention' : 'Submitted data differs from the answer key'}><p>{evaluation.dataMatches ? 'The submitted records match. This does not validate a config.' : `${evaluation.missing.length} missing, ${evaluation.extra.length} extra, ${evaluation.repeated.length} repeated IDs and ${evaluation.wrongValues.length} incorrect values in this submission.`} This lab result does not change the config run’s verdict.</p>{evaluation.unsupportedClaims.length > 0 && <ul>{evaluation.unsupportedClaims.map((claim, index) => <li key={index}>{claim}</li>)}</ul>}{evaluation.ineffectiveNavigation.length > 0 && <p>{evaluation.ineffectiveNavigation.length} navigation claims were contradicted.</p>}</Notice><RawResult label="Fixture evaluation" value={evaluation} /></>;
}
