import { prisma } from '@/lib/db';
import { classifyTask } from './router';
import { generateCandidates } from './generate';
import { runJudge } from './judge';
import { buildReliabilityReport } from './reliability';
import type { RunInput, RetrievalChunkData, VerificationResult } from './types';
import { defaultLLM } from '@/lib/llm';
import { retrieve, chunkDocument } from '@/lib/retrieval/retrieve';
import {
  verifyArithmetic,
  verifySafety,
  type CitationVerificationResult,
} from '@/lib/verifiers';
import { logger } from '@/lib/logger';
import { readAttachmentContent } from '@/lib/storage';
import { tavilySearch } from '@/lib/tavily';
import { runBaseline } from './baseline';
import { runImproved } from './improved';
import { appendRun, runId as runIdFromLog, type RunRecord } from '@/lib/run-log';

const VERSION_TAG = process.env.VERSION_TAG ?? 'dev';

export interface RunPipelineResult {
  runId: string;
  finalAnswer: string;
  reliability: ReturnType<typeof buildReliabilityReport>;
  latencyMs: number;
  /** Present when improvedMode was used; for research export. */
  runTrace?: RunRecord;
}

export async function executeRun(input: RunInput): Promise<RunPipelineResult> {
  const start = Date.now();
  const run = await prisma.run.create({
    data: {
      ...(input.userId ? { user: { connect: { id: input.userId } } } : {}),
      inputText: input.inputText,
      conversationHistory:
        input.conversationHistory?.length ?
          (input.conversationHistory as object)
        : undefined,
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
  const candidateCount = Math.min(5, Math.max(1, parseInt(process.env.CANDIDATE_COUNT ?? '1', 10) || 1));
  const skipRouter = process.env.SKIP_ROUTER !== 'false';
  const taskType = skipRouter ? 'unknown' : await classifyTask(input.inputText, hasAttachments, defaultLLM);
  await prisma.run.update({ where: { id: runId }, data: { taskType } });

  let chunks: RetrievalChunkData[] = [];
  let docChunks: { docId: string; text: string }[] = [];

  if (input.attachmentIds?.length) {
    for (const attId of input.attachmentIds) {
      const content = await readAttachmentContent(attId);
      if (content) docChunks.push(...chunkDocument(content, attId));
    }
  }
  const urlImages: Record<string, string[]> = {};
  if (input.urls?.length) {
    const { fetchUrlContentAndImages } = await import('@/lib/urls');
    for (const url of input.urls) {
      const { text: content, imageUrls } = await fetchUrlContentAndImages(url);
      if (content) docChunks.push(...chunkDocument(content, url));
      if (imageUrls.length > 0) urlImages[url] = imageUrls;
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

  let contextExcerpts = chunks.map((c) => c.text);
  let tavilyData: Awaited<ReturnType<typeof tavilySearch>> = null;
  const useTavily = process.env.TAVILY_ENABLED === 'true' && !input.attachmentIds?.length && !input.urls?.length;
  if (useTavily) {
    tavilyData = await tavilySearch(input.inputText);
    if (tavilyData?.results?.length) {
      const webContext = tavilyData.results.map(
        (r) => `[${r.title}](${r.url}): ${r.content}`
      );
      contextExcerpts = [...contextExcerpts, ...webContext];
    }
  }

  const promptForPipeline =
    contextExcerpts.length > 0
      ? `Relevant context:\n${contextExcerpts.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')}\n\nUser question: ${input.inputText}`
      : input.inputText;
  const systemPrompt = 'You are a helpful assistant. Answer clearly and concisely. Be accurate. For math, show your work.';

  if (typeof input.improvedMode === 'boolean') {
    const mode = input.improvedMode ? 'improved' : 'baseline';
    const run_id = runIdFromLog(promptForPipeline, mode, runId);
    if (input.improvedMode) {
      const result = await runImproved({
        prompt: promptForPipeline,
        systemPrompt,
        evalMode: false,
        baseSeed: runId,
      });
      const runRecord: RunRecord = {
        run_id,
        timestamp: new Date().toISOString(),
        mode: 'improved',
        inputs: { prompt: promptForPipeline, n_candidates: result.candidates.length },
        outputs: {
          final_answer: result.final_answer,
          candidates: result.candidates,
          judge: result.metadata.judge,
          verification: result.metadata.verification,
        },
        latency_ms: result.metadata.latencyMs,
      };
      appendRun(runRecord);
      const latencyMs = Date.now() - start;
      const reliability = buildReliabilityReport(
        chunks.length > 0,
        [],
        undefined
      );
      await prisma.run.update({
        where: { id: runId },
        data: { finalAnswer: result.final_answer, latencyMs, reliability: reliability as object },
      });
      return { runId, finalAnswer: result.final_answer, reliability, latencyMs, runTrace: runRecord };
    } else {
      const result = await runBaseline({
        prompt: promptForPipeline,
        systemPrompt,
        baseSeed: runId,
      });
      const runRecord: RunRecord = {
        run_id,
        timestamp: new Date().toISOString(),
        mode: 'baseline',
        inputs: { prompt: promptForPipeline, seed: result.metadata.seed },
        outputs: { final_answer: result.final_answer, candidates: result.candidates },
        latency_ms: result.metadata.latencyMs,
      };
      appendRun(runRecord);
      const latencyMs = Date.now() - start;
      const reliability = buildReliabilityReport(
        chunks.length > 0,
        [],
        undefined
      );
      await prisma.run.update({
        where: { id: runId },
        data: { finalAnswer: result.final_answer, latencyMs, reliability: reliability as object },
      });
      return { runId, finalAnswer: result.final_answer, reliability, latencyMs, runTrace: runRecord };
    }
  }

  const genResults = await generateCandidates(
    taskType,
    input.inputText,
    contextExcerpts,
    candidateCount,
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

  const singleCandidate = candidatesWithVerifications.length === 1;
  let chosenCandidateId: string;
  let finalAnswer: string;
  let chosenVerifications: VerificationResult[];

  if (singleCandidate) {
    chosenCandidateId = candidatesWithVerifications[0].id;
    finalAnswer = candidatesWithVerifications[0].data.outputText;
    chosenVerifications = candidatesWithVerifications[0].verifications;
    await prisma.judgeDecision.create({
      data: {
        runId,
        chosenCandidateId,
        rubricScoresJson: {},
        rationaleText: 'Single candidate (no judge).',
      },
    });
  } else {
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
    chosenCandidateId = judgeOutput.chosenCandidateId;
    const chosenCandidate = await prisma.candidate.findUnique({
      where: { id: judgeOutput.chosenCandidateId },
    });
    finalAnswer = chosenCandidate?.outputText ?? genResults[0]?.output ?? '';
    if (judgeOutput.finalAnswerEdit) finalAnswer = judgeOutput.finalAnswerEdit;
    chosenVerifications =
      candidatesWithVerifications.find((c) => c.id === judgeOutput.chosenCandidateId)?.verifications ?? [];
  }
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
      ...(Object.keys(urlImages).length > 0 ? { urlImages: urlImages as object } : {}),
      ...(tavilyData ? { tavilySearchResults: tavilyData as object } : {}),
    },
  });

  logger.info('Run completed', { runId, latencyMs, taskType });
  return { runId, finalAnswer, reliability, latencyMs };
}
