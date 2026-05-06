import React, { useState, useEffect, useMemo } from 'react';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Search, Play, Copy, Check, ChevronRight, Layout, Zap, Boxes, Terminal } from 'lucide-react';
import { createHighlighter } from 'shiki';
import { clsx, type ClassValue } from 'clsx';
// @ts-ignore
import { twMerge } from 'tailwind-merge';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- Components ---

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    async function highlight() {
      try {
        const highlighter = await createHighlighter({
          themes: ['github-dark'],
          langs: ['typescript']
        });
        const h = highlighter.codeToHtml(code, {
          lang: 'typescript',
          theme: 'github-dark'
        });
        setHtml(h);
      } catch (err) {
        setHtml(`<pre>${escapeHtml(code)}</pre>`);
      }
    }
    highlight();
  }, [code]);


  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl glass border-slate-800 shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label || 'Output'}</span>
        </div>
        <button
          onClick={handleCopy}
          className="p-1.5 hover:bg-slate-700 rounded-md transition-all text-slate-400 hover:text-slate-100"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>
      </div>
      <div className="flex-1 p-0 overflow-auto bg-[#282c34] text-sm custom-scrollbar">
        {html ? (
          <div className="shiki-container p-6 [&>pre]:!bg-transparent [&>pre]:!m-0" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre className="p-6 text-slate-500 animate-pulse font-mono">Highlighting...</pre>
        )}
      </div>
    </div>
  );
}


export default function App() {
  const [client, setClient] = useState<Client | null>(null);
  const [tools, setTools] = useState<any[]>([]);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, any>>({});
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModel2, setShowModel2] = useState(false);

  // Initialize MCP Client
  useEffect(() => {
    const initClient = async () => {
      try {
        setError(null);
        console.log('Connecting to MCP server...');
        const transport = new SSEClientTransport(new URL('http://localhost:3001/sse'));
        const mcpClient = new Client(
          { name: 'Smart Table Inspector UI', version: '1.0.0' },
          { capabilities: {} }
        );
        await mcpClient.connect(transport);
        setClient(mcpClient);
        setConnected(true);

        const { tools: mcpTools } = await mcpClient.listTools();
        setTools(mcpTools);
        if (mcpTools.length > 0) setSelectedTool(mcpTools[0].name);
      } catch (err) {
        console.error('Failed to connect to MCP server:', err);
        setError(String(err));
      }
    };
    initClient();
  }, []);

  const handleCopyBoth = () => {

    if (results.length === 0) return;
    const combined = results.map((r, i) => `// --- Model: ${results.length > 1 ? (i === 0 ? params.options?.model1 : params.options?.model2) : 'Output'} ---\n${r.text}`).join('\n\n');
    navigator.clipboard.writeText(combined);
  };



  const tool = useMemo(() => tools.find(t => t.name === selectedTool), [tools, selectedTool]);

  const availableModels = useMemo(() => {
    const inspectTool = tools.find(t => t.name === 'inspect_table');
    if (!inspectTool?.inputSchema) return ['gpt-4o', 'o1-mini'];
    
    // The schema is JSON Schema. We look for options.model1.enum
    const schema = inspectTool.inputSchema as any;
    const modelEnum = schema.properties?.options?.properties?.model1?.enum;
    return modelEnum || ['gpt-4o', 'o1-mini'];
  }, [tools]);

  const handleRun = async () => {

    if (!client || !selectedTool) return;
    setLoading(true);
    setResults([]);
    try {
      const response = await client.callTool({
        name: selectedTool,
        arguments: params
      });
      setResults(response.content as any[] || []);
    } catch (err) {

      setResults([{ type: 'text', text: `Error: ${err}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleParamChange = (key: string, value: any) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden font-sans">
      {/* Sidebar - 250px */}
      <aside className="w-[250px] flex flex-col border-r border-slate-800 bg-slate-900/30">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Zap size={18} className="text-white fill-white" />
          </div>
          <h1 className="font-bold text-sm tracking-tight">Smart Table <span className="text-blue-500">Inspector</span></h1>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-6">
          <section>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 mb-3 block">Available Tools</label>
            <div className="space-y-1">
              {tools.map(t => (
                <button
                  key={t.name}
                  onClick={() => setSelectedTool(t.name)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group",
                    selectedTool === t.name 
                      ? "bg-blue-600/10 text-blue-400 ring-1 ring-blue-500/20" 
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  )}
                >
                  <Boxes size={14} className={selectedTool === t.name ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"} />
                  {t.name.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </section>

          {tool && (
            <section className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 block">Parameters</label>
              <div className="space-y-6 px-2">
                <div>
                  <label className="text-[11px] text-slate-400 mb-1.5 block">Target URL</label>
                  <div className="space-y-2">
                    <select 
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all text-slate-200"
                      onChange={(e) => handleParamChange('url', e.target.value)}
                    >
                      <option value="">Select a common target...</option>
                      <option value="https://mui.com/x/react-data-grid/">MUI Data Grid</option>
                      <option value="https://ant.design/components/table">Ant Design Table</option>
                      <option value="https://www.ag-grid.com/example/">AG Grid</option>
                      <option value="https://glideapps.github.io/glide-data-grid/">Glide Data Grid</option>
                    </select>
                    <input 
                      type="text"
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-700"
                      placeholder="Or enter custom URL..."
                      value={params.url || ''}
                      onChange={(e) => handleParamChange('url', e.target.value)}
                    />
                  </div>
                </div>

                {/* Dynamically render some common params for brevity in this MVP */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1.5 block">Primary Model</label>
                    <select 
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all text-slate-200"
                      onChange={(e) => handleParamChange('options', { ...params.options, model1: e.target.value })}
                      value={params.options?.model1 || 'gpt-4o'}
                    >
                      {availableModels.map((m: string) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {!showModel2 ? (
                    <button 
                      onClick={() => setShowModel2(true)}
                      className="flex items-center gap-2 text-[10px] font-bold text-blue-500 hover:text-blue-400 transition-colors px-1"
                    >
                      <Boxes size={12} /> Add Comparison Model
                    </button>
                  ) : (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] text-slate-400 block">Comparison Model</label>
                        <button onClick={() => setShowModel2(false)} className="text-[10px] text-slate-600 hover:text-slate-400">Remove</button>
                      </div>
                      <select 
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all text-slate-200"
                        onChange={(e) => handleParamChange('options', { ...params.options, model2: e.target.value })}
                        value={params.options?.model2 || ''}
                      >
                        <option value="">None</option>
                        {availableModels.map((m: string) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  )}

                </div>

                <button
                  onClick={handleRun}
                  disabled={loading || !connected}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold py-2.5 rounded-lg shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Play size={14} fill="white" />
                  )}
                  Run Discovery
                </button>
              </div>
            </section>
          )}

        </div>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-800">
            <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.3)]", connected ? "bg-emerald-500 shadow-emerald-500/50" : "bg-red-500 shadow-red-500/50")} />
            <span className="text-[10px] font-medium text-slate-400 uppercase">
              {connected ? 'Connected' : (error ? `Offline: ${error}` : 'Offline')}
            </span>
          </div>
        </div>

      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
        <header className="h-16 border-b border-slate-800/50 flex items-center justify-between px-8 bg-slate-950/20 backdrop-blur-sm">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-500">Playground</span>
            <ChevronRight size={12} className="text-slate-700" />
            <span className="font-semibold text-slate-200">{selectedTool?.replace(/_/g, ' ')}</span>
          </div>
          <div className="flex items-center gap-3">
             <button 
               onClick={results.length > 0 ? handleCopyBoth : () => setShowModel2(true)}
               className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600/10 border border-blue-500/20 text-[11px] font-bold text-blue-400 hover:bg-blue-600/20 transition-all active:scale-95 shadow-lg shadow-blue-900/10"
             >
               {results.length > 0 ? (
                 <><Copy size={12} /> Copy All</>
               ) : (
                 <><Boxes size={12} /> Add Model</>
               )}
             </button>
          </div>
        </header>


        <div className="flex-1 overflow-auto p-8">
          {!results.length && !loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 animate-in fade-in zoom-in-95 duration-700">
              <Terminal size={48} className="mb-4 opacity-20" />
              <p className="text-sm font-medium">Ready to start discovery</p>
              <p className="text-xs opacity-60">Enter a URL and click Run Discovery to begin</p>
            </div>
          ) : (
            <div className={cn(
              "grid gap-6 h-full min-h-[500px]",
              results.length > 1 ? "grid-cols-2" : "grid-cols-1"
            )}>
              {results.map((item, i) => (
                <CodeBlock key={i} code={item.text} label={item.text.match(/### Model: (.*)/)?.[1] || `Result ${i + 1}`} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
