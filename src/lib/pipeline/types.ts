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
  userId?: string;
  /** Previous messages for multi-turn chat. Each turn is a full run; history is sent so the model has context. */
  conversationHistory?: { role: string; content: string }[];
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
