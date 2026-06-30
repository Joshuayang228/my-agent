import { memo, useState, useEffect, useRef, useId, useSyncExternalStore } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css'
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown'
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml'
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql'
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go'
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust'
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java'
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c'
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp'
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff'
import mermaid from 'mermaid'

SyntaxHighlighter.registerLanguage('tsx', tsx)
SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('python', python)
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('shell', bash)
SyntaxHighlighter.registerLanguage('sh', bash)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('css', css)
SyntaxHighlighter.registerLanguage('markdown', markdown)
SyntaxHighlighter.registerLanguage('md', markdown)
SyntaxHighlighter.registerLanguage('yaml', yaml)
SyntaxHighlighter.registerLanguage('yml', yaml)
SyntaxHighlighter.registerLanguage('sql', sql)
SyntaxHighlighter.registerLanguage('go', go)
SyntaxHighlighter.registerLanguage('rust', rust)
SyntaxHighlighter.registerLanguage('java', java)
SyntaxHighlighter.registerLanguage('c', c)
SyntaxHighlighter.registerLanguage('cpp', cpp)
SyntaxHighlighter.registerLanguage('diff', diff)
SyntaxHighlighter.registerLanguage('html', tsx)
SyntaxHighlighter.registerLanguage('jsx', tsx)
SyntaxHighlighter.registerLanguage('ts', typescript)
SyntaxHighlighter.registerLanguage('js', javascript)
SyntaxHighlighter.registerLanguage('py', python)

const LIGHT_THEMES = new Set(['light', 'mist', 'green-garden', 'golden'])

function getTheme() {
  const t = document.documentElement.getAttribute('data-theme') || 'dark'
  return LIGHT_THEMES.has(t) ? 'light' : 'dark'
}

function subscribeTheme(cb: () => void) {
  const observer = new MutationObserver(cb)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}

function useCurrentTheme() {
  return useSyncExternalStore(subscribeTheme, getTheme)
}

function initMermaid(isDark: boolean) {
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    themeVariables: isDark
      ? { darkMode: true, background: '#1e293b', primaryColor: '#06b6d4', primaryTextColor: '#e2e8f0', lineColor: '#64748b' }
      : { darkMode: false, background: '#ffffff', primaryColor: '#2563eb', primaryTextColor: '#1e293b', lineColor: '#94a3b8' },
  })
}

initMermaid(getTheme() === 'dark')

interface MarkdownRendererProps {
  content: string
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="rounded px-2 py-0.5 text-xs transition"
      style={{ color: 'var(--text-muted)' }}
    >
      {copied ? '已复制' : '复制'}
    </button>
  )
}

function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const id = 'mermaid-' + useId().replace(/:/g, '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    mermaid.render(id, code).then(({ svg }) => {
      if (!cancelled && containerRef.current) {
        containerRef.current.innerHTML = svg
      }
    }).catch((err) => {
      if (!cancelled) setError(String(err))
    })
    return () => { cancelled = true }
  }, [code, id])

  if (error) return <pre className="rounded-lg bg-red-950/30 p-3 text-xs text-red-400">{error}</pre>
  return <div ref={containerRef} className="my-3 flex justify-center overflow-x-auto rounded-lg p-4" style={{ background: 'var(--card-bg)' }} />
}

function splitAside(raw: string): { main: string; asides: string[] } {
  const re = /<aside>([\s\S]*?)<\/aside>/gi
  const asides: string[] = []
  let match: RegExpExecArray | null
  while ((match = re.exec(raw)) !== null) {
    const text = match[1].trim()
    if (text) asides.push(text)
  }
  const main = raw.replace(re, '').replace(/<\/?aside\b[^>]*>/gi, '').trim()
  return { main, asides }
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const { main, asides } = splitAside(content)
  const theme = useCurrentTheme()
  const isDark = theme === 'dark'
  const codeStyle = isDark ? oneDark : oneLight

  useEffect(() => {
    initMermaid(isDark)
  }, [isDark])

  return (
    <div className="markdown-body">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '')
          const codeString = String(children).replace(/\n$/, '')

          if (match?.[1] === 'mermaid') {
            return <MermaidBlock code={codeString} />
          }

          if (match) {
            return (
              <div className="group relative my-3 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--card-border)' }}>
                <div className="flex items-center justify-between px-4 py-1.5 text-xs" style={{ background: 'var(--bg-tertiary)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{match[1]}</span>
                  <CopyButton text={codeString} />
                </div>
                <SyntaxHighlighter
                  style={codeStyle}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: 0,
                    background: 'var(--bg-inset)',
                    fontSize: '0.8125rem',
                    lineHeight: '1.6',
                  }}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            )
          }

          return (
            <code
              className="rounded px-1.5 py-0.5 text-[0.8125rem]"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--accent-fg)' }}
              {...props}
            >
              {children}
            </code>
          )
        },

        // 表格
        table({ children }) {
          return (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          )
        },
        thead({ children }) {
          return <thead className="border-b" style={{ borderColor: 'var(--border-color)' }}>{children}</thead>
        },
        th({ children }) {
          return <th className="px-3 py-2 text-left text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{children}</th>
        },
        td({ children }) {
          return <td className="border-t px-3 py-2" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>{children}</td>
        },

        // 块元素
        p({ children }) {
          return <p className="my-2 leading-relaxed">{children}</p>
        },
        h1({ children }) {
          return <h1 className="mb-3 mt-6 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{children}</h1>
        },
        h2({ children }) {
          return <h2 className="mb-2 mt-5 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{children}</h2>
        },
        h3({ children }) {
          return <h3 className="mb-2 mt-4 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{children}</h3>
        },
        ul({ children }) {
          return <ul className="my-2 ml-5 list-disc space-y-1">{children}</ul>
        },
        ol({ children }) {
          return <ol className="my-2 ml-5 list-decimal space-y-1">{children}</ol>
        },
        li({ children }) {
          return <li style={{ color: 'var(--text-primary)' }}>{children}</li>
        },
        blockquote({ children }) {
          return (
            <blockquote className="my-3 pl-4 italic" style={{ color: 'var(--text-muted)', borderLeft: '3px solid var(--accent)' }}>
              {children}
            </blockquote>
          )
        },
        hr() {
          return <hr className="my-4" style={{ borderColor: 'var(--border-color)' }} />
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition"
              style={{ color: 'var(--accent-fg)', textDecorationColor: 'var(--accent-subtle)' }}
            >
              {children}
            </a>
          )
        },
        strong({ children }) {
          return <strong className="font-semibold" style={{ color: 'var(--text-primary)' }}>{children}</strong>
        },
      }}
    >
      {main}
    </ReactMarkdown>
    {asides.length > 0 && (
      <div className="mt-2 space-y-1">
        {asides.map((text, i) => (
          <p key={i} className="text-[11px] italic" style={{ color: 'var(--text-muted)' }}>
            {text}
          </p>
        ))}
      </div>
    )}
    </div>
  )
})
