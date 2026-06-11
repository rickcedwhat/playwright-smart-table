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
