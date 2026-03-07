'use client';

import { Component, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const baseClasses =
  'markdown-content text-[15px] leading-[1.6] text-slate-800 break-words';

class MarkdownErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

/** Math-like: backslash commands, sub/superscript, common LaTeX */
const MATH_LIKE =
  /[=\\_^]|\\\\(?:frac|text|sqrt|sum|int|prod|lim|alpha|beta|gamma|delta|Delta|theta|pi|infty|cdot|times|quad|qquad|left|right|begin|end|matrix|pmatrix|bmatrix|vmatrix|cases|align|equation|array)/;

/**
 * Normalize LLM math delimiters to $ and $$ so KaTeX can render.
 * Handles: \[ \], \( \), [ formula ], ((x)), etc.
 */
function normalizeMathDelimiters(text: string): string {
  if (text == null || typeof text !== 'string') return '';

  let out = text;

  // Standard LaTeX display: \[ ... \] → $$ ... $$
  out = out.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, inner) => (inner.trim() ? `$$${inner.trim()}$$` : '$$\\quad$$'));

  // Standard LaTeX inline: \( ... \) → $ ... $
  out = out.replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_, inner) => (inner.trim() ? `$${inner.trim()}$` : '$\\quad$'));

  // Block: line entirely [ ... ] with math-like content → $$ ... $$
  out = out.replace(/^\s*\[\s*([\s\S]*?)\]\s*$/gm, (_, inner) => {
    const t = inner.trim();
    if (t.length > 0 && MATH_LIKE.test(t)) return `$$${t}$$`;
    return `[ ${inner} ]`;
  });

  // Inline: (( x )) → $x$
  out = out.replace(/\(\(\s*([a-zA-Z])\s*\)\)/g, '$$1$');
  // Inline: ( x ) with spaces (avoids "e.g." and "i.e.")
  out = out.replace(/\(\s+([a-zA-Z])\s+\)/g, '$$1$');

  // Avoid empty math blocks that can break the AST ($$$$ or $$ $$)
  out = out.replace(/\$\$\s*\$\$/g, '$$\\quad$$');
  out = out.replace(/\$\s+\$/g, '$\\quad$');

  return out;
}

const markdownComponents = {
  img: ({ src, alt, ...props }: { src?: string; alt?: string }) =>
    src ? (
      <span className="block my-4">
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg overflow-hidden border border-slate-200 hover:border-teal-400 hover:shadow-lg transition-all duration-200 group"
        >
          <img
            src={src}
            alt={alt ?? ''}
            className="max-w-full h-auto w-full object-contain group-hover:scale-[1.02] transition-transform duration-200"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            {...props}
          />
        </a>
        {alt && (
          <p className="text-xs text-slate-500 mt-1.5 text-center italic">{alt}</p>
        )}
      </span>
    ) : null,
  p: ({ children }: { children?: ReactNode }) => <p className="m-0 mb-2 last:mb-0">{children}</p>,
  ul: ({ children }: { children?: ReactNode }) => <ul className="list-disc ml-4 my-2 space-y-0.5">{children}</ul>,
  ol: ({ children }: { children?: ReactNode }) => <ol className="list-decimal ml-4 my-2 space-y-0.5">{children}</ol>,
  li: ({ children }: { children?: ReactNode }) => <li className="leading-relaxed">{children}</li>,
  code: ({ className: codeClass, children, ...props }: { className?: string; children?: ReactNode }) => {
    const isInline = !codeClass;
    if (isInline)
      return (
        <code className="px-1.5 py-0.5 rounded-none bg-slate-100 text-slate-800 font-mono text-[0.9em]" {...props}>
          {children}
        </code>
      );
    return <code className={codeClass} {...props}>{children}</code>;
  },
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="my-2 p-3 rounded-none bg-slate-100 overflow-x-auto text-[0.9em]">
      {children}
    </pre>
  ),
};

export function MarkdownContent({
  content,
  className = '',
}: {
  content: string;
  className?: string;
}) {
  const safeContent = content ?? '';
  const normalized = normalizeMathDelimiters(safeContent);

  return (
    <div className={`${baseClasses} ${className}`}>
      <MarkdownErrorBoundary
        fallback={<pre className="whitespace-pre-wrap text-sm">{safeContent}</pre>}
      >
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[[rehypeKatex, { strict: false }]]}
          components={markdownComponents}
        >
          {normalized}
        </ReactMarkdown>
      </MarkdownErrorBoundary>
    </div>
  );
}
