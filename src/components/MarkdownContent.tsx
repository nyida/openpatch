'use client';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const baseClasses =
  'markdown-content text-[15px] leading-[1.6] text-slate-800 break-words';

/** Math-like: contains backslash, =, subscript, superscript, or common LaTeX */
const MATH_LIKE = /[=\\_^]|\\\\(?:frac|text|Delta|alpha|beta|sum|int|times|cdot|quad|qquad|left|right|begin|end)/;

/**
 * Normalize common LLM math delimiters to $ and $$ so KaTeX can render.
 * - [ formula ] (block) → $$ formula $$
 * - ( letter ) or (( letter )) (inline variable) → $letter$
 */
function normalizeMathDelimiters(text: string): string {
  let out = text;
  // Standard LaTeX display: \[ ... \] → $$ ... $$
  out = out.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, '$$$1$$');
  // Block: line that is entirely [ ... ] with math-like content → $$ ... $$
  out = out.replace(/^\s*\[\s*([\s\S]*?)\]\s*$/gm, (_, inner) => {
    const t = inner.trim();
    if (t.length > 0 && MATH_LIKE.test(t)) return `$$${t}$$`;
    return `[ ${inner} ]`;
  });
  // Inline: (( x )) → $x$ (double parens, single letter)
  out = out.replace(/\(\(\s*([a-zA-Z])\s*\)\)/g, '$$1$');
  // Inline: ( x ) → $x$ when there are spaces inside (avoids "e.g." and "i.e.")
  out = out.replace(/\(\s+([a-zA-Z])\s+\)/g, '$$1$');
  return out;
}

export function MarkdownContent({
  content,
  className = '',
}: {
  content: string;
  className?: string;
}) {
  const normalized = normalizeMathDelimiters(content);
  return (
    <div className={`${baseClasses} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className="m-0 mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc ml-4 my-2 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal ml-4 my-2 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline)
              return (
                <code className="px-1.5 py-0.5 rounded-none bg-slate-100 text-slate-800 font-mono text-[0.9em]" {...props}>
                  {children}
                </code>
              );
            return <code className={className} {...props}>{children}</code>;
          },
          pre: ({ children }) => (
            <pre className="my-2 p-3 rounded-none bg-slate-100 overflow-x-auto text-[0.9em]">
              {children}
            </pre>
          ),
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
