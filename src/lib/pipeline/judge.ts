import type { CandidateData, VerificationResult, JudgeOutput } from './types';

export async function runJudge(
  userRequest: string,
  contextExcerpts: string[],
  candidates: { id: string; data: CandidateData; verifications: VerificationResult[] }[],
  llm: { complete: (messages: { role: string; content: string }[], opts?: { maxTokens?: number }) => Promise<string> }
): Promise<JudgeOutput> {
  const contextBlock =
    contextExcerpts.length > 0
      ? `Context:\n${contextExcerpts.slice(0, 3).map((c, i) => `[${i + 1}] ${c.slice(0, 200)}`).join('\n')}`
      : 'No context.';

  const candidatesBlock = candidates
    .map(
      (c, i) =>
        `--- ${i + 1} (id: ${c.id}) ---\n${c.data.outputText.slice(0, 600)}\nPass: ${c.verifications.map((v) => v.pass).join(',')}`
    )
    .join('\n\n');

  const prompt = `Judge. Pick the best candidate. User request: ${userRequest.slice(0, 300)}

${contextBlock}

${candidatesBlock}

Reply JSON only: {"chosenId": "<id>", "rationale": "one sentence", "finalAnswerEdit": null}`;

  const raw = await llm.complete(
    [
      { role: 'system', content: 'You output only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    { maxTokens: 256 }
  );
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
