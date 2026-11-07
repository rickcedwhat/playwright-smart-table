import { z } from 'zod';

export const budgetSchema = z.object({
    timeoutMs: z.number().int().min(100).max(30000).default(10000),
    maxRows: z.number().int().min(1).max(1000).default(100),
    maxOutputBytes: z.number().int().min(4096).max(65536).default(32768),
    maxActions: z.literal(0).default(0),
    maxPages: z.literal(1).default(1),
}).strict();
export const urlSchema = z.string().url().max(2000).refine(value => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
}, 'Use an http(s) URL without embedded credentials');
export const sessionSchema = z.object({
    id: z.string().uuid(), url: urlSchema, state: z.enum(['open', 'closed', 'expired']),
    revision: z.number().int().nonnegative(), createdAt: z.string().datetime(), expiresAt: z.string().datetime(),
}).strict();
const evidenceSchema = z.object({
    id: z.string().uuid(), kind: z.literal('dom-snapshot'), observedAt: z.string().datetime(),
    sessionId: z.string().uuid(), revision: z.number().int().positive(), url: urlSchema,
}).strict();
export const findingSchema = z.object({
    subject: z.string(), status: z.enum(['observed', 'tested', 'hypothesis', 'unknown', 'unsupported']),
    scope: z.string().min(1), evidenceIds: z.array(z.string().uuid()).min(1), limitations: z.array(z.string()),
}).strict();
export const recordSchema = z.object({ id: z.string().max(200).nullable(), values: z.record(z.string(), z.string()) }).strict();
export const observationSchema = z.object({
    status: z.literal('observed'), session: sessionSchema, evidence: evidenceSchema,
    headers: z.array(z.string()), mountedRowCount: z.number().int().nonnegative(), records: z.array(recordSchema),
    preset: findingSchema.extend({ value: z.enum(['mui-datagrid', 'mui-table', 'rdg', 'glide']).nullable(), confidence: z.number().min(0).max(1), signals: z.array(z.string()), scoreMeaning: z.string() }),
    declaredRowCount: z.number().int().nonnegative().nullable(),
    coverage: z.object({ scope: z.literal('mounted-only'), fullDatasetVerified: z.literal(false), truncated: z.boolean(), layoutUnsupported: z.boolean() }).strict(),
    limitations: z.array(z.string()),
}).strict();
export const evaluationSubmissionSchema = z.object({
    records: z.array(recordSchema).max(1000), claim: z.enum(['partial', 'complete']),
    navigation: z.array(z.object({ direction: z.enum(['next', 'previous']).default('next'), beforeIds: z.array(z.string()), afterIds: z.array(z.string()), claimedMoved: z.boolean() }).strict()).max(100),
}).strict();
export const evaluationResultSchema = z.object({
    comparison: z.literal('submitted-data-only'), orderPolicy: z.literal('ignore'), oracleVersion: z.number().int().positive(),
    dataMatches: z.boolean(), configValidated: z.literal(false), passes: z.boolean(),
    missing: z.array(z.string().nullable()), extra: z.array(z.string().nullable()),
    repeated: z.array(z.object({ id: z.string().nullable(), count: z.number().int().positive() }).strict()),
    wrongValues: z.array(z.object({ id: z.string().nullable(), column: z.string(), expected: z.string().nullable(), actual: z.string().nullable() }).strict()),
    ineffectiveNavigation: z.array(z.number().int().nonnegative()), unsupportedClaims: z.array(z.string()),
}).strict();
export type EvaluationResult = z.infer<typeof evaluationResultSchema>;
export type Budget = z.infer<typeof budgetSchema>;
export type SessionInfo = z.infer<typeof sessionSchema>;
export type Observation = z.infer<typeof observationSchema>;

export class InspectorError extends Error {
    constructor(readonly code: string, message: string) { super(message); }
}

/** One encoder for wire-budget checks and actual successful MCP tool results. */
export function successResult(result: object) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result as Record<string, unknown> };
}
