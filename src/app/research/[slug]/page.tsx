'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MarketingShell, Section } from '@/components/marketing/MarketingShell';
import { FadeUp } from '@/components/marketing/Motion';
import { ArticleBlocks } from '@/components/marketing/ArticleBlocks';
import { TrialCtaBandCompact } from '@/components/marketing/TrialCtaBand';
import { getResearch, relatedResearch } from '@/lib/content/research';

export default function ResearchDetailPage() {
  const params = useParams();
  const raw = params?.slug;
  const slug = Array.isArray(raw) ? raw[0] : String(raw || '');
  const piece = getResearch(slug);

  if (!piece) {
    return (
      <MarketingShell>
        <Section className="py-24 font-sans text-white">
          <p>Not found.</p>
          <Link href="/research" className="mt-4 inline-block text-[13px] text-white hover:opacity-80">
            ← Research
          </Link>
        </Section>
      </MarketingShell>
    );
  }

  const related = relatedResearch(piece.slug);

  return (
    <MarketingShell>
      <Section className="pb-8 pt-28 font-sans text-white md:pt-32">
        <FadeUp>
          <Link
            href="/research"
            className="text-[13px] text-white transition hover:opacity-80"
          >
            ← Research
          </Link>

          <p className="mt-8 font-sans text-[14px] font-bold tracking-tight text-white">
            Research
          </p>
          <p className="mt-3 text-[13px] text-white">{piece.published}</p>
          <h1 className="mt-3 max-w-2xl font-sans text-[clamp(1.85rem,4.5vw,2.85rem)] font-semibold leading-[1.15] tracking-[-0.04em] text-white">
            {piece.title}
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-white">
            {piece.summary}
          </p>
        </FadeUp>

        <FadeUp delay={0.06}>
          <ArticleBlocks blocks={piece.body} />
        </FadeUp>

        <FadeUp delay={0.08}>
          <div className="mt-14 border-t border-white/15 pt-10 text-[13px] leading-relaxed text-white">
            <h3 className="mb-4 font-sans text-[16px] font-semibold tracking-[-0.02em] text-white">
              References
            </h3>
            <ol className="list-decimal space-y-3 pl-5 text-white">
              {piece.references.map((ref) => (
                <li key={ref.slice(0, 64)}>{ref}</li>
              ))}
            </ol>
          </div>
        </FadeUp>

        {related.length > 0 ? (
          <FadeUp delay={0.1}>
            <div className="mt-14 border-t border-white/15 pt-10">
              <h3 className="font-sans text-[16px] font-semibold tracking-[-0.02em] text-white">
                More from Algomarket
              </h3>
              <ul className="mt-4 space-y-3">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/research/${r.slug}`}
                      className="text-[15px] font-medium text-white underline-offset-2 hover:underline"
                    >
                      {r.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </FadeUp>
        ) : null}
      </Section>

      <Section className="pb-20 md:pb-28">
        <TrialCtaBandCompact />
      </Section>
    </MarketingShell>
  );
}
