import { prisma } from '@/lib/db';
import { classifyTask } from './router';
import { generateCandidates } from './generate';
import { runJudge } from './judge';
import { buildReliabilityReport } from './reliability';
import type { RunInput, RetrievalChunkData, VerificationResult } from './types';
import { defaultLLM } from '@/lib/llm';
import { retrieve, chunkDocument } from '@/lib/retrieval/retrieve';
import {
  extractClaims,
  verifyCitations,
  verifyArithmetic,
  verifyContradiction,
  verifySafety,
  type Claim,
  type CitationVerificationResult,
} from '@/lib/verifiers';
import { logger } from '@/lib/logger';
import { readAttachmentContent } from '@/lib/storage';

const VERSION_TAG = process.env.VERSION_TAG ?? 'dev';

export interface RunPipelineResult {
  runId: string;
  finalAnswer: string;
  reliability: ReturnType<typeof buildReliabilityReport>;
  latencyMs: number;
}

export async function executeRun(input: RunInput): Promise<RunPipelineResult> {
  const start = Date.now();
  const run = await prisma.run.create({
    data: {
      ...(input.userId ? { user: { connect: { id: input.userId } } } : {}),
      inputText: input.inputText,
      conversationHistory: (input.conversationHistory?.length ? input.conversationHistory : null) as object | null,
      taskType: 'unknown',
      versionTag: VERSION_TAG,
    },
  });
  const runId = run.id;
  logger.info('Run started', { runId, inputLen: input.inputText.length });

  if (input.attachmentIds?.length) {
    for (const attId of input.attachmentIds) {
      await prisma.attachment.create({
        data: {
          runId,
          type: 'file',
          originalName: attId,
          storagePath: `${process.env.UPLOAD_DIR ?? 'uploads'}/${attId}`,
          url: null,
        },
      });
    }
  }

  const hasAttachments = (input.attachmentIds?.length ?? 0) > 0 || (input.urls?.length ?? 0) > 0;
  const taskType = await classifyTask(input.inputText, hasAttachments, defaultLLM);
  await prisma.run.update({ where: { id: runId }, data: { taskType } });

  let chunks: RetrievalChunkData[] = [];
  let docChunks: { docId: string; text: string }[] = [];

  if (input.attachmentIds?.length) {
    for (const attId of input.attachmentIds) {
      const content = await readAttachmentContent(attId);
      if (content) docChunks.push(...chunkDocument(content, attId));
    }
  }
  if (input.urls?.length) {
    const { fetchUrlContent } = await import('@/lib/urls');
    for (const url of input.urls) {
      const content = await fetchUrlContent(url);
      if (content) docChunks.push(...chunkDocument(content, url));
    }
  }
  if (docChunks.length > 0) {
    chunks = await retrieve(input.inputText, docChunks, 10);
    await prisma.retrievalChunk.createMany({
      data: chunks.map((c) => ({
        runId,
        docId: c.docId,
        chunkId: c.chunkId,
        text: c.text,
        score: c.score,
      })),
    });
  }

  const contextExcerpts = chunks.map((c) => c.text);
  const genResults = await generateCandidates(
    taskType,
    input.inputText,
    contextExcerpts,
    2,
    input.conversationHistory
  );

  const candidateIds: string[] = [];
  for (const g of genResults) {
    const c = await prisma.candidate.create({
      data: {
        runId,
        modelName: g.config.model,
        promptHash: g.promptHash,
        outputText: g.output,
        tokenCounts: { prompt: g.tokenEstimate[0], completion: g.tokenEstimate[1] },
        latencyMs: g.latencyMs,
      },
    });
    candidateIds.push(c.id);
  }

  const candidatesWithVerifications: {
    id: string;
    data: { modelName: string; promptHash: string; outputText: string; tokenCounts?: { prompt: number; completion: number }; latencyMs: number };
    verifications: VerificationResult[];
  }[] = [];

  for (let i = 0; i < genResults.length; i++) {
    const candId = candidateIds[i];
    const output = genResults[i].output;
    const verifications: VerificationResult[] = [];

    const calcResult = verifyArithmetic(output);
    verifications.push(calcResult);
    await prisma.verification.create({
      data: {
        candidateId: candId,
        type: calcResult.type,
        resultJson: calcResult.resultJson as object,
        passFail: calcResult.pass,
        notes: calcResult.notes ?? null,
      },
    });

    const contradictionResult = await verifyContradiction(output, defaultLLM);
    verifications.push(contradictionResult);
    await prisma.verification.create({
      data: {
        candidateId: candId,
        type: contradictionResult.type,
        resultJson: contradictionResult.resultJson as object,
        passFail: contradictionResult.pass,
        notes: contradictionResult.notes ?? null,
      },
    });

    const safetyResult = verifySafety(input.inputText, output);
    verifications.push(safetyResult);
    await prisma.verification.create({
      data: {
        candidateId: candId,
        type: safetyResult.type,
        resultJson: safetyResult.resultJson as object,
        passFail: safetyResult.pass,
        notes: safetyResult.notes ?? null,
      },
    });

    if (chunks.length > 0) {
      const claims = await extractClaims(output, defaultLLM);
      const citationResults = await verifyCitations(claims, chunks);
      const supported = citationResults.filter((r) => r.supported).length;
      const total = citationResults.length;
      const citationResult: VerificationResult = {
        type: 'citation',
        resultJson: { claims: citationResults, supported, total },
        pass: total === 0 || supported === total,
        notes: total > 0 ? `${supported}/${total} claims supported` : undefined,
      };
      verifications.push(citationResult);
      await prisma.verification.create({
        data: {
          candidateId: candId,
          type: citationResult.type,
          resultJson: citationResult.resultJson as object,
          passFail: citationResult.pass,
          notes: citationResult.notes ?? null,
        },
      });
    }

    const cand = await prisma.candidate.findUnique({ where: { id: candId } });
    if (cand)
      candidatesWithVerifications.push({
        id: candId,
        data: {
          modelName: cand.modelName,
          promptHash: cand.promptHash ?? '',
          outputText: cand.outputText,
          tokenCounts: cand.tokenCounts as { prompt: number; completion: number } | undefined,
          latencyMs: cand.latencyMs ?? 0,
        },
        verifications,
      });
  }

  const judgeOutput = await runJudge(
    input.inputText,
    contextExcerpts,
    candidatesWithVerifications,
    defaultLLM
  );

  await prisma.judgeDecision.create({
    data: {
      runId,
      chosenCandidateId: judgeOutput.chosenCandidateId,
      rubricScoresJson: judgeOutput.rubricScores as object,
      rationaleText: judgeOutput.rationale,
    },
  });

  const chosenCandidate = await prisma.candidate.findUnique({
    where: { id: judgeOutput.chosenCandidateId },
  });
  let finalAnswer = chosenCandidate?.outputText ?? genResults[0]?.output ?? '';
  if (judgeOutput.finalAnswerEdit) finalAnswer = judgeOutput.finalAnswerEdit;

  const chosenVerifications = candidatesWithVerifications.find(
    (c) => c.id === judgeOutput.chosenCandidateId
  )?.verifications ?? [];
  const citationVerification = chosenVerifications.find((v) => v.type === 'citation');
  const citationResultsForReport: CitationVerificationResult[] =
    (citationVerification?.resultJson?.claims as CitationVerificationResult[]) ?? [];
  const reliability = buildReliabilityReport(
    chunks.length > 0,
    chosenVerifications,
    citationResultsForReport.length > 0 ? citationResultsForReport : undefined
  );

  const latencyMs = Date.now() - start;
  await prisma.run.update({
    where: { id: runId },
    data: {
      finalAnswer,
      reliability: reliability as object,
      latencyMs,
      costEstimate: null,
    },
  });

  logger.info('Run completed', { runId, latencyMs, taskType });
  return { runId, finalAnswer, reliability, latencyMs };
}
