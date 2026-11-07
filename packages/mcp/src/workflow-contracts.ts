import { z } from 'zod';
import { recordSchema, sessionSchema } from './contracts.js';
const selector = z.string().trim().min(1).max(500);
export const proposalSchema = z.object({
    root: selector, header: selector, row: selector, cell: selector,
    idAttribute: z.literal('data-id'),
    pagination: z.object({ next: selector, previous: selector }).strict().optional(),
}).strict();
export const workflowBudgetSchema = z.object({
    timeoutMs: z.number().int().min(100).max(120000).default(60000),
    maxActions: z.number().int().min(0).max(30).default(12),
    maxPages: z.number().int().min(1).max(10).default(5),
    maxRows: z.number().int().min(1).max(1000).default(100),
    maxOutputBytes: z.number().int().min(8192).max(131072).default(65536),
}).strict();
const snapshotSchema = z.object({ url: z.string(), ids: z.array(z.string()), values: z.array(z.record(z.string(), z.string())) }).strict();
const traversalSchema = z.object({
    start: snapshotSchema, end: snapshotSchema,
    actions: z.number().int().nonnegative(), pages: z.number().int().nonnegative(),
    rewind: z.enum(['established', 'failed', 'not-needed']),
    restoration: z.enum(['restored', 'failed', 'not-attempted', 'unchanged-original-session']),
    termination: z.enum(['terminal-control', 'single-page', 'action-budget', 'page-budget', 'row-budget', 'ineffective-control', 'cycle', 'unsupported', 'error', 'output-budget']),
}).strict();
export const proposalResultSchema = z.object({
    status: z.literal('proposed'), session: sessionSchema, evidenceId: z.string().uuid(),
    proposal: proposalSchema, code: z.string(), limitations: z.array(z.string()),
}).strict();
export const probeResultSchema = z.object({
    status: z.enum(['tested', 'partial', 'failed']), session: sessionSchema, evidenceId: z.string().uuid(),
    traversal: traversalSchema, records: z.array(recordSchema), fullDatasetVerified: z.literal(false), limitations: z.array(z.string()),
}).strict();
export const validationResultSchema = z.object({
    status: z.enum(['tested', 'partial', 'failed']), runId: z.string().uuid(), sourceUrl: z.string(),
    consumerPackage: z.string(), browserVersion: z.string(), configExecuted: z.literal(true), fullDatasetVerified: z.literal(false),
    library: z.object({ version: z.string(), sha256: z.string(), preparedFromCommit: z.string(), playwright: z.string(), typescript: z.string() }).strict(),
    checks: z.object({ init: z.boolean(), query: z.boolean(), extraction: z.boolean(), reset: z.boolean() }).strict(),
    traversal: traversalSchema, records: z.array(recordSchema),
    diagnostics: z.array(z.string()), elapsedMs: z.number().nonnegative(), limitations: z.array(z.string()),
}).strict();
export type Proposal = z.infer<typeof proposalSchema>;
export type WorkflowBudget = z.infer<typeof workflowBudgetSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;
