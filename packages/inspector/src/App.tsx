import { useEffect, useState } from 'react';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export default function App() {
  const [client, setClient] = useState<Client>();
  const [tools, setTools] = useState<Tool[]>([]);
  const [url, setUrl] = useState('http://127.0.0.1:3001/fixtures/mui-datagrid');
  const [selector, setSelector] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  useEffect(() => {
    const connection = new Client({ name: 'smart-table-inspector-ui', version: '0.1.0' });
    let mounted = true;
    void (async () => {
      try {
        await connection.connect(new StreamableHTTPClientTransport(new URL('/mcp', window.location.origin)));
        const result = await connection.listTools();
        if (mounted) { setTools(result.tools); setClient(connection); }
      } catch (e) { if (mounted) setError(String(e)); }
    })();
    return () => { mounted = false; void connection.close(); };
  }, []);
  async function run() {
    if (!client) return;
    setRunning(true); setError(''); setOutput('');
    try {
      const result = await client.callTool({ name: 'inspect_table', arguments: { url, ...(selector ? { tableSelector: selector } : {}) } });
      const content = Array.isArray(result.content) ? result.content : [];
      const text = content.filter(item => item.type === 'text').map(item => item.text).join('\n');
      if (result.isError) setError(text);
      else setOutput(text);
    } catch (e) { setError(String(e)); }
    finally { setRunning(false); }
  }
  return <div className="bench">
    <aside>
      <h1>Smart Table Inspector</h1>
      <p className="status">{client ? 'Connected' : 'Disconnected'}</p>
      <h2>Inspection bench</h2>
      <p>Observe a table, inspect the evidence, and keep track of what still needs testing.</p>
      <form onSubmit={event => { event.preventDefault(); void run(); }}>
        <label>Target URL<input type="url" required value={url} onChange={event => setUrl(event.target.value)} /></label>
        <label>Table selector<input value={selector} placeholder="Automatic: one table or grid" onChange={event => setSelector(event.target.value)} /></label>
        <button disabled={!client || running}>{running ? 'Inspecting…' : 'Run inspection'}</button>
      </form>
      <h2>Available tools</h2>
      {tools.map(tool => <p key={tool.name}><strong>{tool.name}</strong><br />{tool.description}</p>)}
      <p className="note">Milestone 0 · DOM observation only · No model calls</p>
    </aside>
    <main>
      <header><h2>Findings</h2><span>Raw MCP response</span></header>
      {error && <div role="alert">{error}</div>}
      {output ? <pre aria-label="Inspection findings">{output}</pre> : <p className="intro">The local MUI-shaped fixture is ready to inspect. These findings describe mounted DOM; they do not prove complete traversal or a working config.</p>}
    </main>
  </div>;
}
