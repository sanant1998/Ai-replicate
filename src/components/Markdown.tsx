'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import clsx from 'clsx'
import 'katex/dist/katex.min.css'

/**
 * Models are told to delimit mathematics with $…$, but they routinely fall back
 * to the LaTeX \(…\) and \[…\] forms anyway. remark-math only understands the
 * dollar form, so the text is normalised here rather than trusting the prompt —
 * a prompt is a request, this is a guarantee.
 */
function normaliseMath(src: string) {
  return src
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, body: string) => `$$${body}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, body: string) => `$${body}$`)
}

/**
 * Renders assistant output: GitHub-flavoured markdown plus KaTeX.
 *
 * react-markdown does not pass raw HTML through (no rehype-raw here), so model
 * output cannot inject markup — worth keeping that way, since this renders text
 * that ultimately came from whatever the student typed.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={clsx('md-body', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        // Answers stream in a token at a time, so half-written formulae are
        // normal — they must not throw, just render as-is until complete.
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={{
          p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-2.5 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2.5 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
          ),
          h1: ({ children }) => (
            <h1 className="mb-2 mt-3 text-lg font-extrabold first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-3 text-base font-extrabold first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1.5 mt-3 text-sm font-extrabold uppercase tracking-wide opacity-70 first:mt-0">
              {children}
            </h3>
          ),
          strong: ({ children }) => <strong className="font-extrabold">{children}</strong>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline underline-offset-2"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-2.5 border-l-2 border-current/25 pl-3 opacity-80 last:mb-0">
              {children}
            </blockquote>
          ),
          code: ({ className: cls, children }) => {
            // react-markdown marks fenced blocks with a language-* class; bare
            // inline code has none.
            const fenced = /language-/.test(cls ?? '')
            if (!fenced) {
              return (
                <code className="rounded bg-current/10 px-1 py-0.5 font-mono text-[0.9em]">
                  {children}
                </code>
              )
            }
            return <code className="font-mono text-[0.85em]">{children}</code>
          },
          pre: ({ children }) => (
            <pre className="scroll-slim mb-2.5 overflow-x-auto rounded-xl bg-current/8 p-3 last:mb-0">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="scroll-slim mb-2.5 overflow-x-auto last:mb-0">
              <table className="w-full border-collapse text-left">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-current/20 px-2 py-1.5 font-extrabold">{children}</th>
          ),
          td: ({ children }) => <td className="border-b border-current/10 px-2 py-1.5">{children}</td>,
          hr: () => <hr className="my-3 border-current/15" />,
        }}
      >
        {normaliseMath(children)}
      </ReactMarkdown>
    </div>
  )
}
