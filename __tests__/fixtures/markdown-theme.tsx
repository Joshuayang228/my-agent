import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import { CodeBlock, MarkdownRenderer } from '../../src/components/MarkdownRenderer'
import { WorkspaceFilesPanel } from '../../src/components/chat/right-dock/WorkspaceFilesPanel'
import { THEME_STUDIES, getThemeStudyStyle } from '../../src/components/playground/foundation-themes'

const initialGraph = 'flowchart LR\n  A[Inspect] --> B[Apply]'
const markdown = '```typescript\nconst ready = true\n```\n\n```mermaid\n' + initialGraph + '\n```'
const files = { projectLabel: 'theme-fixture', initialPath: 'notes.md', tree: [{ name: 'notes.md', path: 'notes.md', isDir: false }], files: { 'notes.md': { path: 'notes.md', kind: 'text' as const, content: markdown, languageHint: 'markdown' } } }

function Harness() {
  const [graph, setGraph] = useState(initialGraph)
  const [first, setFirst] = useState(0)
  return <main className="p-3">
    <label>Graph<textarea aria-label="Graph source" className="block w-full border p-2" value={graph} onChange={(event) => setGraph(event.target.value)} /></label>
    <label>First theme<select aria-label="First theme" value={first} onChange={(event) => setFirst(Number(event.target.value))}>{THEME_STUDIES.map((study, index) => <option key={study.id} value={index}>{study.label}</option>)}</select></label>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {THEME_STUDIES.map((original, index) => {
        const study = index === 0 ? THEME_STUDIES[first] : original
        return <section key={original.id} data-testid={`render-theme-${index}`} data-theme-name={study.id} className="min-w-0 p-3" style={{ ...getThemeStudyStyle(study), background: study.colors.app }}>
          <h2>{study.label}</h2>
          <CodeBlock code="const ready = true" language="typescript" />
          <div data-testid="graph"><MarkdownRenderer content={'```mermaid\n' + graph + '\n```'} /></div>
        </section>
      })}
    </div>
    <section data-testid="file-theme" className="mt-3 h-[440px]" style={{ ...getThemeStudyStyle(THEME_STUDIES[1]), background: THEME_STUDIES[1].colors.panel }}>
      <WorkspaceFilesPanel projectPath={null} previewData={files} />
    </section>
  </main>
}

createRoot(document.getElementById('root')!).render(<Harness />)
