'use client';

import type { ResearchBlock } from '@/lib/content/research';

/** Renders Relemetry-style article body blocks: white type, sans font. */
export function ArticleBlocks({ blocks }: { blocks: ResearchBlock[] }) {
  return (
    <div className="article-prose mt-10 space-y-0 font-sans text-white">
      {blocks.map((b, i) => {
        const key = `${b.type}-${i}`;
        if (b.type === 'p') {
          return (
            <p key={key} className="mb-5 text-[15px] leading-relaxed text-white">
              {renderInline(b.text)}
            </p>
          );
        }
        if (b.type === 'h2') {
          return (
            <h2
              key={key}
              className="mb-4 mt-12 font-sans text-[clamp(1.35rem,2.5vw,1.75rem)] font-semibold tracking-[-0.03em] text-white"
            >
              {b.text}
            </h2>
          );
        }
        if (b.type === 'ul') {
          return (
            <ul
              key={key}
              className="mb-5 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-white"
            >
              {b.items.map((item) => (
                <li key={item.slice(0, 48)}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (b.type === 'pullQuote') {
          return (
            <blockquote
              key={key}
              className="my-10 border-y border-white/15 py-6 text-center font-sans text-[clamp(1.15rem,2.2vw,1.4rem)] font-medium leading-snug tracking-[-0.02em] text-white"
            >
              “{b.text.replace(/^“|”$/g, '').replace(/^"|"$/g, '')}”
              {b.attribution ? (
                <span className="mt-3 block text-[13px] font-normal text-white">
                  {b.attribution}
                </span>
              ) : null}
            </blockquote>
          );
        }
        if (b.type === 'stat') {
          return (
            <div
              key={key}
              className="my-8 px-5 py-5 font-sans text-white"
              style={{ background: 'var(--bg-raised)', borderRadius: 0 }}
            >
              <span className="block text-[clamp(1.8rem,4vw,2.4rem)] font-semibold tracking-[-0.04em] text-white">
                {b.value}
              </span>
              <p className="mt-2 text-[14px] leading-relaxed text-white">{b.label}</p>
              {b.source ? (
                <p className="mt-2 text-[12px] text-white">Source: {b.source}</p>
              ) : null}
            </div>
          );
        }
        if (b.type === 'statRow') {
          return (
            <div
              key={key}
              className="my-8 px-5 py-5 text-center font-sans text-white"
              style={{ background: 'var(--bg-raised)' }}
            >
              <div className="mt-2 flex flex-wrap justify-center gap-8">
                {b.stats.map((s) => (
                  <div key={s.label} className="min-w-[120px] flex-1">
                    <div className="text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-[-0.04em] text-white">
                      {s.value}
                    </div>
                    <div className="mt-1 text-[13px] text-white">{s.label}</div>
                  </div>
                ))}
              </div>
              {b.source ? (
                <p className="mt-4 text-left text-[12px] text-white">Source: {b.source}</p>
              ) : null}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(\([^)]+,\s*\d{4}[^)]*\))/g);
  return parts.map((part, i) => {
    if (/^\([^)]+,\s*\d{4}/.test(part)) {
      return (
        <em key={i} className="text-white not-italic">
          {part}
        </em>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
