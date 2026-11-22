import { useEffect, useState } from 'react';

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [feedback, setFeedback] = useState<{ text: string; status: 'copied' | 'failed' }>();
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(undefined), 2500);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  const status = feedback?.text === text ? feedback.status : undefined;
  return <span className="copy-control">
    <span role="status">{status === 'copied' ? 'Copied' : status === 'failed' ? 'Could not copy. Select and copy the text.' : ''}</span>
    <button type="button" className="copy-button" aria-label={`Copy ${label}`} title={status === 'copied' ? 'Copied' : `Copy ${label}`} onClick={() => {
      void (async () => {
        try { await navigator.clipboard.writeText(text); setFeedback({ text, status: 'copied' }); }
        catch { setFeedback({ text, status: 'failed' }); }
      })();
    }}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {status === 'copied' ? <path d="m5 12 4 4L19 6" /> : <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>}
      </svg>
    </button>
  </span>;
}

export function ResultPanel({ label, text }: { label: string; text: string }) {
  return <div className="result-panel"><CopyButton label={label} text={text} /><pre aria-label={label}>{text}</pre></div>;
}
