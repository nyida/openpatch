/**
 * In-process job queue. Designed so it can be swapped to Redis later.
 * Jobs run in the same process; for long runs we still process synchronously
 * in the API handler but store state in DB. A future Redis worker would
 * consume the same job payloads.
 */
export type JobType = 'run' | 'eval';

export interface JobPayload {
  type: JobType;
  runId?: string;
  evalSuiteId?: string;
  evalCaseIds?: string[];
}

type JobHandler = (payload: JobPayload) => Promise<void>;

const handlers: Map<JobType, JobHandler> = new Map();

export function registerHandler(type: JobType, handler: JobHandler) {
  handlers.set(type, handler);
}

export async function enqueue(payload: JobPayload): Promise<void> {
  const handler = handlers.get(payload.type);
  if (handler) {
    await handler(payload);
  }
}

export function getQueueStats(): { registered: JobType[] } {
  return { registered: Array.from(handlers.keys()) };
}
