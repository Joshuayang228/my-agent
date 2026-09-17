import { Children, isValidElement, memo, useState, useEffect, useRef, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { IconButton } from './foundation/IconButton'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
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
import { splitAside } from '../shared/aside'
import { isSafeMarkdownImageSource } from '../shared/markdown-security'
import { useSurfaceTheme } from './foundation/useSurfaceTheme'
import { renderMermaid } from './foundation/mermaid-renderer'
import { SYNTAX_HIGHLIGHT_THEMES } from './foundation/syntax-highlight-theme'

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

function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  if (isSafeMarkdownImageSource(src)) {
    return <img src={src} alt={alt || '图片'} className="my-3 max-h-96 max-w-full rounded-lg" />
  }
  if (src) {
    try {
      const parsed = new URL(src)
      if (parsed.protocol === 'https:') {
        return (
          <a href={parsed.toString()} target="_blank" rel="noopener noreferrer" className="text-xs underline">
            {alt ? `外部图片：${alt}（点击打开）` : '外部图片已阻止自动加载（点击打开）'}
          </a>
        )
      }
    } catch { /* 非 URL 统一降级为文本 */ }
  }
  return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>图片来源不受支持</span>
}

interface MarkdownRendererProps {
  content: string
  /** 兼容现有故事调用；代码块已统一使用相同语义主题，不再维护变体皮肤。 */
  variant?: 'default' | 'playground'
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const request = useRef(0)
  useEffect(() => {
    setCopied(false)
    setError(false)
    return () => { request.current++; clearTimeout(timer.current) }
  }, [text])

  const handleCopy = async () => {
    const version = ++request.current
    try {
      await navigator.clipboard.writeText(text)
      if (version !== request.current) return
      setError(false)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      if (version !== request.current) return
      setCopied(false)
      setError(true)
    }
  }

  return (
    <span className="relative flex h-7 w-7 shrink-0">
      {error && <span role="status" className="absolute right-full top-0 flex h-7 items-center whitespace-nowrap px-2 text-xs" style={{ color: 'var(--danger)', background: 'var(--bg-tertiary)' }}>复制失败，请重试</span>}
      <IconButton label={copied ? '已复制' : '复制'} title={error ? '复制失败，请重试' : undefined} size={28} onClick={handleCopy} style={{ color: 'var(--text-muted)' }}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </IconButton>
    </span>
  )
}

/**
 * 背景：审阅文件可能包含 Markdown 围栏和 aside，拼进 Markdown 会改变原文。
 * 设计意图：复用高亮与复制容器，直接接收原始代码，而不是重走正文解析器。
 * 关键约束：不解析链接、HTML 或 Mermaid；复制内容逐字保留，主题底色由语义 token 提供。
 */
export function CodeBlock({ code, language = 'text' }: { code: string; language?: string }) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const theme = useSurfaceTheme(surfaceRef)
  return <div ref={surfaceRef} className="group relative my-3 min-w-0 overflow-hidden rounded-lg border"
    data-testid="markdown-code-block" data-foundation="code-block" style={{ borderColor: 'var(--card-border)' }}>
    <div className="flex items-center justify-between gap-2 px-4 py-1.5 text-xs" style={{ background: 'var(--bg-tertiary)' }}>
      <span className="min-w-0 truncate" style={{ color: 'var(--text-muted)' }}>{language}</span>
      <CopyButton text={code} />
    </div>
    <SyntaxHighlighter style={theme?.mode === 'light' ? SYNTAX_HIGHLIGHT_THEMES.light : SYNTAX_HIGHLIGHT_THEMES.dark} language={language}
      tabIndex={0} aria-label="代码内容" codeTagProps={{ style: { background: 'transparent' } }}
      customStyle={{ margin: 0, borderRadius: 0, background: 'var(--bg-inset)', fontSize: '0.8125rem', lineHeight: '1.6', overflow: 'auto' }}>
      {code}
    </SyntaxHighlighter>
  </div>
}

function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const theme = useSurfaceTheme(containerRef)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!theme) return
    const controller = new AbortController()
    setError(false)
    void renderMermaid(code, theme, controller.signal, containerRef.current?.clientWidth ?? 0).then((rendered) => {
      if (rendered !== null && !controller.signal.aborted) setSvg(rendered)
    }).catch(() => {
      if (controller.signal.aborted) return
      setSvg('')
      setError(true)
    })
    return () => controller.abort()
  }, [code, theme])

  return <div ref={containerRef} className="my-3 min-w-0 overflow-x-auto rounded-lg p-4" style={{ background: 'var(--bg-inset)' }} data-foundation="mermaid">
    {error ? <><p role="alert" className="text-xs" style={{ color: 'var(--danger)' }}>图表无法绘制，请检查语法。</p><CodeBlock code={code} language="mermaid" /></>
      : <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: svg }} />}
  </div>
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const { main, asides } = splitAside(content)

  return (
    <div className="markdown-body">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        img({ src, alt }) {
          return <MarkdownImage src={src} alt={alt} />
        },
        pre({ children }) {
          const child = Children.toArray(children).find(isValidElement<{ className?: string; children?: ReactNode }>)
          const language = /language-([^\s]+)/.exec(child?.props.className ?? '')?.[1] ?? 'text'
          const codeString = String(child?.props.children ?? '').replace(/\n$/, '')
          if (language === 'mermaid') {
            return <MermaidBlock code={codeString} />
          }
          return <CodeBlock code={codeString} language={language} />
        },
        code({ children }) {
          return (
            <code
              className="rounded px-1.5 py-0.5 text-[0.8125rem]"
              style={{ background: 'var(--bg-inset)', color: 'var(--accent-fg)' }}
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
          return <blockquote className="md-blockquote">{children}</blockquote>
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
