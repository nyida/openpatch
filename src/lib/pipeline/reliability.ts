import type { ReliabilityReport } from './types';
import type { VerificationResult } from './types';
import { claimsSupportedPercent, type CitationVerificationResult } from '@/lib/verifiers';

export function buildReliabilityReport(
  retrievalUsed: boolean,
  verifications: VerificationResult[],
  citationResults?: CitationVerificationResult[]
): ReliabilityReport {
  const citation = verifications.find((v) => v.type === 'citation');
  const calculator = verifications.find((v) => v.type === 'calculator');
  const contradiction = verifications.find((v) => v.type === 'contradiction');
  const safety = verifications.find((v) => v.type === 'safety');

  const claimsPct =
    retrievalUsed && citationResults && citationResults.length > 0
      ? claimsSupportedPercent(citationResults)
      : undefined;
  const arithmeticVerified = calculator ? calculator.pass : undefined;
  const contradictionsDetected = contradiction ? !contradiction.pass : undefined;

  const reasons: string[] = [];
  if (retrievalUsed) {
    if (claimsPct !== undefined) reasons.push(`${claimsPct}% of claims supported by sources`);
    else reasons.push('Retrieval used; no claim-level verification');
  } else reasons.push('No retrieval used');
  if (arithmeticVerified !== undefined) reasons.push(arithmeticVerified ? 'Arithmetic verified' : 'Arithmetic check failed or not applicable');
  if (contradictionsDetected !== undefined) reasons.push(contradictionsDetected ? 'Contradictions detected' : 'No contradictions detected');
  if (safety && !safety.pass) reasons.push('Safety check flagged');

  let overallConfidence: 'low' | 'medium' | 'high' = 'medium';
  if (contradictionsDetected || (retrievalUsed && claimsPct !== undefined && claimsPct < 50)) overallConfidence = 'low';
  else if (
    verifications.length > 0 &&
    !contradictionsDetected &&
    (claimsPct === undefined || claimsPct >= 80) &&
    (arithmeticVerified === undefined || arithmeticVerified)
  ) overallConfidence = 'high';

  return {
    retrievalUsed,
    claimsSupportedPercent: claimsPct,
    arithmeticVerified,
    contradictionsDetected,
    overallConfidence,
    explanation: reasons.join('. '),
  };
}
