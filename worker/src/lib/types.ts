// TODO(#288 Phase 4): remove QueuedPR, QueueLevel, QueueState, CRLabel after queue cleanup
export interface QueuedPR {
  pr: number;
  title: string;
  queued_at: string;
}

export type QueueLevel = 'priority' | 'normal' | 'backburner';

export interface QueueState {
  tokens: number;
  last_decremented_at: string;
  refill_qstash_id: string;
  refill_at: string;
  priority: QueuedPR[];
  normal: QueuedPR[];
  backburner: QueuedPR[];
  reviews_this_session: number;
}

export type CRLabel =
  | 'coderabbit: not started'
  | 'coderabbit: waiting'
  | 'coderabbit: rate-limited'
  | 'coderabbit: queued'
  | 'coderabbit: unresolved'
  | 'coderabbit: complete';

export type CommitState = 'pending' | 'success' | 'failure' | 'error';

// AI Review types

export type AIReviewLabel =
  | 'ai-review: not started'
  | 'ai-review: waiting'
  | 'ai-review: unresolved'
  | 'ai-review: complete';

export interface ReviewConfig {
  focus?: string[];
  ignore?: string[];
  context_files?: string[];
  checklist?: string[];
  model_override?: string;
  planning?: {
    enabled?: boolean;
    focus?: string[];
  };
}

export interface ReviewRound {
  round: number;
  timestamp: string;
  commit_sha: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  summary: string;
}

export interface SpendLimits {
  repo_daily: number;
  global_daily: number;
  global_monthly: number;
}

export interface SpendStatus {
  repo_daily: number;
  global_daily: number;
  global_monthly: number;
  limits: SpendLimits;
}

export interface AIProviderResponse {
  review_body: string;
  input_tokens: number;
  output_tokens: number;
  model: string;
}
