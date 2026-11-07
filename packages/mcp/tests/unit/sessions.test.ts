import { it, expect, vi } from 'vitest';
const fake = vi.hoisted(() => ({ close: () => Promise.resolve() }));
vi.mock('@playwright/test', () => ({ chromium: { launch: async () => ({
    newPage: async () => ({ goto: async () => undefined, url: () => 'http://localhost/table' }),
    close: () => fake.close(),
}) } }));
import { SessionManager } from '../../src/sessions.js';
const signal = () => new AbortController().signal;
it('reserves capacity until browser closing completes', async () => {
    const manager = new SessionManager(10000, 1);
    let release!: () => void;
    fake.close = () => new Promise<void>(resolve => { release = resolve; });
    try {
        const session = await manager.open('http://localhost/table', 1000, signal());
        const closing = manager.close(session.id);
        await expect(manager.open('http://localhost/table', 1000, signal())).rejects.toMatchObject({ code: 'SESSION_LIMIT' });
        release(); await closing;
        fake.close = () => Promise.resolve();
        await manager.open('http://localhost/table', 1000, signal());
    } finally { fake.close = () => Promise.resolve(); await manager.dispose(); }
});
it('rejects synchronous work that passes its deadline before the timer fires', async () => {
    const manager = new SessionManager();
    try {
        const session = await manager.open('http://localhost/table', 1000, signal());
        await expect(manager.run(session.id, 5, signal(), async () => {
            const end = Date.now() + 20;
            while (Date.now() < end) { /* Deliberately prevent timeout callback delivery. */ }
            return true;
        })).rejects.toMatchObject({ code: 'TIME_BUDGET' });
        await expect(manager.run(session.id, 1000, signal(), async () => true)).rejects.toMatchObject({ code: 'STALE_SESSION' });
    } finally { await manager.dispose(); }
});
