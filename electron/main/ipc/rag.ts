import { ipcMain, dialog } from 'electron'
import * as rag from '../rag/index'
import { loadMainLLMConfig } from '../llm/aux-config'

export function registerRagIPC(): void {
  ipcMain.handle('rag:list', async () => rag.listDocuments())

  ipcMain.handle('rag:ingest', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '文档', extensions: ['txt', 'md', 'json', 'csv', 'log', 'yaml', 'yml', 'xml', 'html', 'py', 'js', 'ts'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    })
    if (result.canceled || result.filePaths.length === 0) return []
    if (result.filePaths.length > 20) throw new Error('一次最多导入 20 个文档')

    const config = await loadMainLLMConfig()
    if (!config.apiKey) throw new Error('请先配置 API Key')

    const docs = []
    for (const fp of result.filePaths) {
      const doc = await rag.ingestDocument(fp, config)
      docs.push(doc)
    }
    return docs
  })

  ipcMain.handle('rag:delete', async (_event, docId: string) => {
    if (typeof docId !== 'string' || !docId.trim() || docId.length > 200) throw new Error('文档 ID 无效')
    return rag.deleteDocument(docId)
  })
}
