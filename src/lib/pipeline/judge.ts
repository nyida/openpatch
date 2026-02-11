import type { CandidateData, VerificationResult, RetrievalChunkData, JudgeOutput } from './types';

export async function runJudge(
  userRequest: string,
  contextExcerpts: string[],
  candidates: { id: string; data: CandidateData; verifications: VerificationResult[] }[],
  llm: { complete: (messages: { role: string; content: string }[]) => Promise<string> }
): Promise<JudgeOutput> {
  const contextBlock =
    contextExcerpts.length > 0
      ? `Retrieved context excerpts:\n${contextExcerpts.slice(0, 5).map((c, i) => `[${i + 1}] ${c.slice(0, 400)}`).join('\n\n')}`
      : 'No retrieved context.';

  const candidatesBlock = candidates
    .map(
      (c, i) =>
        `--- Candidate ${i + 1} (id: ${c.id}) ---\n${c.data.outputText.slice(0, 2000)}\nVerifications: ${JSON.stringify(
          c.verifications.map((v) => ({ type: v.type, pass: v.pass, notes: v.notes }))
        )}`
    )
    .join('\n\n');

  const prompt = `You are a judge. Given the user request, retrieved context (if any), candidate answers, and verifier results, choose the best answer.

RUBRIC: Score each candidate on (1) correctness (2) completeness (3) instruction-following (4) uncertainty calibration. Consider verifier pass/fail. Prefer candidates with verified claims and no contradictions.

${contextBlock}

User request: ${userRequest}

${candidatesBlock}

Respond in this exact JSON format (no other text):
{"chosenId": "<candidate id>", "scores": {"candidateId1": {"correctness": 0-10, "completeness": 0-10, "instructionFollowing": 0-10, "uncertaintyCalibration": 0-10}, ...}, "rationale": "brief explanation", "finalAnswerEdit": null or "optional minor edit to chosen answer", "uncertaintyNotes": "what remains uncertain"}`;

  const raw = await llm.complete([
    { role: 'system', content: 'You output only valid JSON.' },
    { role: 'user', content: prompt },
  ]);
  const parsed = parseJudgeResponse(raw, candidates.map((c) => c.id));
  return parsed;
}

function parseJudgeResponse(
  raw: string,
  candidateIds: string[]
): JudgeOutput {
  const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*$/g, '').trim();
  let obj: {
    chosenId?: string;
    scores?: Record<string, Record<string, number>>;
    rationale?: string;
    finalAnswerEdit?: string | null;
    uncertaintyNotes?: string;
  };
  try {
    obj = JSON.parse(cleaned) as typeof obj;
  } catch {
    return {
      chosenCandidateId: candidateIds[0],
      rubricScores: {},
      rationale: 'Parse error: ' + raw.slice(0, 200),
      uncertaintyNotes: 'Could not parse judge output',
    };
  }
  const chosenId = obj.chosenId && candidateIds.includes(obj.chosenId) ? obj.chosenId : candidateIds[0];
  const rubricScores: Record<string, number> = {};
  if (obj.scores && obj.scores[chosenId]) {
    const s = obj.scores[chosenId];
    rubricScores.correctness = s.correctness ?? 5;
    rubricScores.completeness = s.completeness ?? 5;
    rubricScores.instructionFollowing = s.instructionFollowing ?? 5;
    rubricScores.uncertaintyCalibration = s.uncertaintyCalibration ?? 5;
  }
  return {
    chosenCandidateId: chosenId,
    rubricScores,
    rationale: obj.rationale ?? 'No rationale',
    finalAnswerEdit: obj.finalAnswerEdit ?? undefined,
    uncertaintyNotes: obj.uncertaintyNotes,
  };
}
