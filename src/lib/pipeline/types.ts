export type TaskType =
  | 'factual_with_sources'
  | 'math_logic'
  | 'code_assistance'
  | 'general_writing'
  | 'unknown';

export interface RunInput {
  inputText: string;
  urls?: string[];
  attachmentIds?: string[];
  /** Map of attachment id -> display name for trace */
  attachmentNames?: Record<string, string>;
  userId?: string;
  /** Previous messages for multi-turn chat. Each turn is a full run; history is sent so the model has context. */
  conversationHistory?: { role: string; content: string }[];
  /** When true use multi-sample + judge pipeline; when false use single-call baseline. Omitted = legacy pipeline. */
  improvedMode?: boolean;
  /** When true use 1 candidate for fastest response (Improved mode only). */
  fast?: boolean;
}

export interface RetrievalChunkData {
  docId: string;
  chunkId: string;
  text: string;
  score: number;
}

export interface CandidateData {
  modelName: string;
  promptHash: string;
  outputText: string;
  tokenCounts?: { prompt: number; completion: number };
  latencyMs: number;
}

export interface VerificationResult {
  type: string;
  resultJson: Record<string, unknown>;
  pass: boolean;
  notes?: string;
}

export interface JudgeOutput {
  chosenCandidateId: string;
  rubricScores: Record<string, number>;
  rationale: string;
  finalAnswerEdit?: string;
  uncertaintyNotes?: string;
}

export interface ReliabilityReport {
  retrievalUsed: boolean;
  claimsSupportedPercent?: number;
  arithmeticVerified?: boolean;
  contradictionsDetected?: boolean;
  overallConfidence: 'low' | 'medium' | 'high';
  explanation: string;
}
