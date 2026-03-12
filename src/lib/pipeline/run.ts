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
import { readAttachmentContent, getStoragePathForId } from '@/lib/storage';
import { tavilySearch } from '@/lib/tavily';
import { searchWeb } from '@/lib/searxng';
import { crossrefSearch } from '@/lib/crossref';
import { wikipediaSearch } from '@/lib/wikipedia';
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
  /** URLs of images from web search or URLs for display when relevant */
  images?: { url: string; title?: string }[];
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
    await prisma.attachment.createMany({
      data: input.attachmentIds.map((attId) => ({
        runId,
        type: 'file',
        originalName: input.attachmentNames?.[attId] ?? attId,
        storagePath: getStoragePathForId(attId),
        url: null,
      })),
    });
  }

  const hasAttachments = (input.attachmentIds?.length ?? 0) > 0 || (input.urls?.length ?? 0) > 0;
  const candidateCount = Math.min(5, Math.max(1, parseInt(process.env.CANDIDATE_COUNT ?? '3', 10) || 3));
  const skipRouter = process.env.SKIP_ROUTER !== 'false';
  const taskType = skipRouter ? 'unknown' : await classifyTask(input.inputText, hasAttachments, defaultLLM);
  await prisma.run.update({ where: { id: runId }, data: { taskType } });

  let chunks: RetrievalChunkData[] = [];
  let docChunks: { docId: string; text: string }[] = [];

  const [attachmentChunks, urlResults] = await Promise.all([
    input.attachmentIds?.length
      ? Promise.all(input.attachmentIds.map((attId) => readAttachmentContent(attId)))
          .then((contents) =>
            contents.flatMap((content, i) =>
              content ? chunkDocument(content, input.attachmentIds![i]) : []
            )
          )
      : Promise.resolve([]),
    input.urls?.length
      ? (async () => {
          const { fetchUrlContentAndImages } = await import('@/lib/urls');
          return Promise.all(input.urls!.map((url) => fetchUrlContentAndImages(url)));
        })()
      : Promise.resolve([]),
  ]);
  for (const c of attachmentChunks) docChunks.push(c);
  const urlImages: Record<string, string[]> = {};
  if (input.urls?.length) {
    for (let i = 0; i < input.urls.length; i++) {
      const { text: content, imageUrls } = urlResults[i];
      if (content) docChunks.push(...chunkDocument(content, input.urls[i]));
      if (imageUrls.length > 0) urlImages[input.urls[i]] = imageUrls;
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
  const searchQuery = input.inputText.trim();
  const hasTavilyKey = !!process.env.TAVILY_API_KEY?.trim();
  const tavilyExplicitlyDisabled = process.env.TAVILY_ENABLED === 'false';
  const useTavily = hasTavilyKey && !tavilyExplicitlyDisabled && searchQuery.length > 0;
  const useSearXNG = process.env.SEARXNG_ENABLED === 'true' && searchQuery.length > 0 && !useTavily;

  const [tavilyData, searxngData, crossrefData, wikipediaData] = await Promise.all([
    useTavily ? tavilySearch(searchQuery) : Promise.resolve(null),
    useSearXNG ? searchWeb(searchQuery, { maxResults: 8, maxImages: 8, includeImages: true }) : Promise.resolve(null),
    searchQuery ? crossrefSearch(searchQuery, { maxResults: 5 }) : Promise.resolve(null),
    searchQuery ? wikipediaSearch(searchQuery, { maxResults: 5 }) : Promise.resolve(null),
  ]);

  if (tavilyData?.results?.length) {
    const webContext = tavilyData.results.map(
      (r) => `[${r.title}](${r.url}): ${r.content}`
    );
    contextExcerpts = [...contextExcerpts, ...webContext];
  }
  if (searxngData?.results?.length) {
    const webContext = searxngData.results.map(
      (r) => `[${r.title}](${r.url}): ${r.content}`
    );
    contextExcerpts = [...contextExcerpts, ...webContext];
  }
  if (searxngData?.images?.length) {
    const imageContext = searxngData.images
      .filter((img) => img.url)
      .slice(0, 8)
      .map((img) => `Image (${img.title || 'diagram'}): ${img.url}`);
    contextExcerpts = [...contextExcerpts, ...imageContext];
  }
  if (crossrefData?.results?.length) {
    const crossrefContext = crossrefData.results.map(
      (r) => `[${r.title}](${r.url}): ${r.content}`
    );
    contextExcerpts = [...contextExcerpts, ...crossrefContext];
  }
  if (wikipediaData?.results?.length) {
    const wikiContext = wikipediaData.results.map(
      (r) => `[${r.title}](${r.url}): ${r.content}`
    );
    contextExcerpts = [...contextExcerpts, ...wikiContext];
  }
  if (tavilyData?.images?.length) {
    const imageContext = tavilyData.images
      .filter((img) => img.url)
      .slice(0, 8)
      .map((img) => `Image (${img.description || 'diagram'}): ${img.url}`);
    contextExcerpts = [...contextExcerpts, ...imageContext];
  }
  for (const [url, imgs] of Object.entries(urlImages)) {
    if (imgs?.length) {
      contextExcerpts = [...contextExcerpts, `Images from ${url}: ${imgs.slice(0, 6).join(', ')}`];
    }
  }

  const collectedImages: { url: string; title?: string }[] = [];
  if (searxngData?.images?.length) {
    for (const img of searxngData.images.slice(0, 6)) {
      if (img.url) collectedImages.push({ url: img.url, title: img.title });
    }
  }
  if (tavilyData?.images?.length) {
    for (const img of tavilyData.images.slice(0, 6)) {
      if (img.url) collectedImages.push({ url: img.url, title: img.description });
    }
  }
  for (const imgs of Object.values(urlImages)) {
    for (const url of (imgs ?? []).slice(0, 4)) {
      if (url) collectedImages.push({ url });
    }
  }

  const promptForPipeline =
    contextExcerpts.length > 0
      ? `Relevant context:\n${contextExcerpts.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')}\n\nUser question: ${input.inputText}`
      : input.inputText;
  const systemPrompt = `You are a helpful assistant. Answer clearly and thoroughly. Be accurate. For math, show your work.
When the context includes image URLs (from web search, diagrams, or linked pages), include 1–3 relevant images in your response using markdown: ![brief description](url). Do this whenever images would help illustrate your answer—e.g. for visual concepts, products, places, diagrams, or step-by-step guides. Use only image URLs that appear in the provided context. Keep responses substantive but focused—avoid unnecessary padding.`;

  if (typeof input.improvedMode === 'boolean') {
    const mode = input.improvedMode ? 'improved' : 'baseline';
    const run_id = runIdFromLog(promptForPipeline, mode, runId);
    if (input.improvedMode) {
      const nCandidates = input.fast ? 1 : undefined;
      const result = await runImproved({
        prompt: promptForPipeline,
        systemPrompt,
        evalMode: false,
        baseSeed: runId,
        nCandidates,
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
        data: {
          finalAnswer: result.final_answer,
          latencyMs,
          reliability: reliability as object,
          ...(Object.keys(urlImages).length > 0 ? { urlImages: urlImages as object } : {}),
          ...(tavilyData ? { tavilySearchResults: tavilyData as object } : {}),
          ...(searxngData ? { searxngSearchResults: searxngData as object } : {}),
          ...(crossrefData ? { crossrefSearchResults: crossrefData as object } : {}),
          ...(wikipediaData ? { wikipediaSearchResults: wikipediaData as object } : {}),
        },
      });
      return { runId, finalAnswer: result.final_answer, reliability, latencyMs, runTrace: runRecord, images: collectedImages.length ? collectedImages : undefined };
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
        data: {
          finalAnswer: result.final_answer,
          latencyMs,
          reliability: reliability as object,
          ...(Object.keys(urlImages).length > 0 ? { urlImages: urlImages as object } : {}),
          ...(tavilyData ? { tavilySearchResults: tavilyData as object } : {}),
          ...(searxngData ? { searxngSearchResults: searxngData as object } : {}),
          ...(crossrefData ? { crossrefSearchResults: crossrefData as object } : {}),
          ...(wikipediaData ? { wikipediaSearchResults: wikipediaData as object } : {}),
        },
      });
      return { runId, finalAnswer: result.final_answer, reliability, latencyMs, runTrace: runRecord, images: collectedImages.length ? collectedImages : undefined };
    }
  }

  const genResults = await generateCandidates(
    taskType,
    input.inputText,
    contextExcerpts,
    candidateCount,
    input.conversationHistory
  );

  const createdCandidates = await prisma.candidate.createManyAndReturn({
    data: genResults.map((g) => ({
      runId,
      modelName: g.config.model,
      promptHash: g.promptHash,
      outputText: g.output,
      tokenCounts: { prompt: g.tokenEstimate[0], completion: g.tokenEstimate[1] },
      latencyMs: g.latencyMs,
    })),
  });
  const candidateIds = createdCandidates.map((c) => c.id);

  const verificationRows: { candidateId: string; type: string; resultJson: object; passFail: boolean; notes: string | null }[] = [];
  const candidatesWithVerifications: {
    id: string;
    data: { modelName: string; promptHash: string; outputText: string; tokenCounts?: { prompt: number; completion: number }; latencyMs: number };
    verifications: VerificationResult[];
  }[] = [];

  for (let i = 0; i < genResults.length; i++) {
    const candId = candidateIds[i];
    const output = genResults[i].output;
    const calcResult = verifyArithmetic(output);
    const safetyResult = verifySafety(input.inputText, output);
    verificationRows.push(
      { candidateId: candId, type: calcResult.type, resultJson: calcResult.resultJson as object, passFail: calcResult.pass, notes: calcResult.notes ?? null },
      { candidateId: candId, type: safetyResult.type, resultJson: safetyResult.resultJson as object, passFail: safetyResult.pass, notes: safetyResult.notes ?? null }
    );
    const cand = createdCandidates[i];
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
        verifications: [calcResult, safetyResult],
      });
  }
  if (verificationRows.length > 0) {
    await prisma.verification.createMany({
      data: verificationRows,
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
      ...(searxngData ? { searxngSearchResults: searxngData as object } : {}),
      ...(crossrefData ? { crossrefSearchResults: crossrefData as object } : {}),
      ...(wikipediaData ? { wikipediaSearchResults: wikipediaData as object } : {}),
    },
  });

  logger.info('Run completed', { runId, latencyMs, taskType });
  return { runId, finalAnswer, reliability, latencyMs, images: collectedImages.length ? collectedImages : undefined };
}
