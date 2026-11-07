import { randomUUID } from 'node:crypto';
import { chromium, type Browser, type Page } from '@playwright/test';
import { InspectorError, urlSchema, type SessionInfo } from './contracts.js';

type Session = { info: SessionInfo; browser: Browser; page: Page; busy: boolean; lifetime: AbortController };

/** Browser sessions belong to one MCP connection; handles never cross connection owners. */
export class SessionManager {
    private sessions = new Map<string, Session>();
    private opening = 0;
    private openingControllers = new Set<AbortController>();
    private closing = new Map<string, Promise<void>>();
    private disposed = false;
    private timer: ReturnType<typeof setInterval>;
    constructor(private ttlMs = 300000, private maxSessions = 3) {
        this.timer = setInterval(() => {
            for (const [id, session] of this.sessions) {
                if (!session.busy && Date.now() >= Date.parse(session.info.expiresAt)) void this.close(id);
            }
        }, Math.min(ttlMs, 10000));
        this.timer.unref();
    }
    async open(url: string, timeoutMs: number, signal: AbortSignal): Promise<SessionInfo> {
        if (this.disposed) throw new InspectorError('CONNECTION_CLOSED', 'MCP connection is closed.');
        if (this.sessions.size + this.opening + this.closing.size >= this.maxSessions) throw new InspectorError('SESSION_LIMIT', 'Close a browser session before opening another (limit 3).');
        this.opening++;
        let browser: Browser | undefined;
        const shutdown = new AbortController();
        this.openingControllers.add(shutdown);
        const deadline = AbortSignal.timeout(timeoutMs);
        const combined = AbortSignal.any([signal, deadline, shutdown.signal]);
        const close = () => { void browser?.close(); };
        combined.addEventListener('abort', close, { once: true });
        const end = Date.now() + timeoutMs;
        try {
            combined.throwIfAborted();
            browser = await chromium.launch({ timeout: Math.max(1, end - Date.now()) });
            combined.throwIfAborted();
            const page = await browser.newPage();
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: Math.max(1, end - Date.now()) });
            combined.throwIfAborted();
            if (this.disposed) throw new InspectorError('CONNECTION_CLOSED', 'MCP connection closed during browser startup.');
            if (Date.now() >= end) throw new InspectorError('TIME_BUDGET', 'Session opening exceeded deadline.');
            urlSchema.parse(page.url());
            const info: SessionInfo = { id: randomUUID(), url: page.url(), state: 'open', revision: 0, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + this.ttlMs).toISOString() };
            this.sessions.set(info.id, { info, browser, page, busy: false, lifetime: new AbortController() });
            return { ...info };
        } catch (error) {
            await browser?.close();
            throw combined.aborted || Date.now() >= end ? new InspectorError(deadline.aborted || Date.now() >= end ? 'TIME_BUDGET' : 'CANCELLED', 'Session opening cancelled or time budget exhausted.') : error;
        } finally {
            combined.removeEventListener('abort', close);
            this.openingControllers.delete(shutdown);
            this.opening--;
        }
    }
    async run<T>(id: string, timeoutMs: number, signal: AbortSignal, operation: (page: Page, info: SessionInfo, remaining: () => number, operationSignal: AbortSignal) => Promise<T>): Promise<T> {
        const session = this.sessions.get(id);
        if (!session || Date.now() >= Date.parse(session.info.expiresAt)) {
            await this.close(id);
            throw new InspectorError('STALE_SESSION', 'Browser session is closed, expired, or belongs to another MCP connection. Open a new session.');
        }
        if (session.busy) throw new InspectorError('SESSION_BUSY', 'A browser session allows one operation at a time.');
        session.busy = true;
        session.info.revision++;
        session.info.expiresAt = new Date(Date.now() + this.ttlMs).toISOString();
        const deadline = AbortSignal.timeout(timeoutMs);
        const combined = AbortSignal.any([signal, deadline, session.lifetime.signal]);
        const close = () => { void this.close(id); };
        combined.addEventListener('abort', close, { once: true });
        const end = Date.now() + timeoutMs;
        try {
            combined.throwIfAborted();
            const result = await operation(session.page, { ...session.info }, () => Math.max(1, end - Date.now()), combined);
            combined.throwIfAborted();
            if (Date.now() >= end) throw new InspectorError('TIME_BUDGET', 'Operation exceeded deadline.');
            return result;
        } catch (error) {
            if (combined.aborted || Date.now() >= end) {
                await this.close(id);
                await Promise.allSettled([...this.closing.values()]);
                throw new InspectorError(deadline.aborted || Date.now() >= end ? 'TIME_BUDGET' : 'CANCELLED', 'Inspection cancelled or time budget exhausted; browser session was invalidated.');
            }
            throw error;
        } finally {
            combined.removeEventListener('abort', close);
            session.busy = false;
        }
    }
    async close(id: string): Promise<{ closed: boolean }> {
        const session = this.sessions.get(id);
        if (!session) { await this.closing.get(id); return { closed: false }; }
        this.sessions.delete(id);
        session.lifetime.abort();
        const closing = session.browser.close().finally(() => this.closing.delete(id));
        this.closing.set(id, closing);
        await closing;
        return { closed: true };
    }
    async dispose() {
        this.disposed = true;
        clearInterval(this.timer);
        for (const controller of this.openingControllers) controller.abort();
        while (this.opening) await new Promise(resolve => setTimeout(resolve, 10));
        await Promise.allSettled([...this.sessions.keys()].map(id => this.close(id)));
        await Promise.allSettled([...this.closing.values()]);
    }
}
