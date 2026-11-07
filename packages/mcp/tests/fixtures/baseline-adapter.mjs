// Scripted protocol smoke only. This is NOT a model or an agent-quality baseline.
let raw = ''; for await (const chunk of process.stdin) raw += chunk;
const { messages } = JSON.parse(raw);
const results = messages.filter(message => message.role === 'tool').map(message => ({ name: message.name, result: JSON.parse(message.content) }));
const latest = name => results.findLast(value => value.name === name)?.result.structuredContent;
const opened = latest('open_session'), proposed = latest('propose_config'), validated = latest('validate_config');
const url = messages.find(message => message.role === 'user').content.match(/Investigate (http\S+)\./)[1];
const action = !opened ? { type: 'tool', name: 'open_session', arguments: { url } }
  : !proposed ? { type: 'tool', name: 'propose_config', arguments: { sessionId: opened.id } }
  : !validated ? { type: 'tool', name: 'validate_config', arguments: { sessionId: opened.id, proposal: proposed.proposal } }
  : { type: 'final', outcome: validated.status === 'tested' ? 'ready' : 'partial', runId: validated.runId, summary: 'Scripted harness assertion; no model inference.' };
console.log(JSON.stringify({ action }));
