import { ipcMain, dialog } from 'electron'
import * as rag from '../rag/index'
import * as settings from '../storage/settings-store'

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

    const allSettings = await settings.getAllSettings()
    const config = {
      apiKey: allSettings.apiKey || '',
      baseUrl: allSettings.baseUrl || 'https://api.openai.com/v1',
      model: allSettings.model || 'gpt-4o-mini',
    }

    const docs = []
    for (const fp of result.filePaths) {
      const doc = await rag.ingestDocument(fp, config)
      docs.push(doc)
    }
    return docs
  })

  ipcMain.handle('rag:delete', async (_event, docId: string) => rag.deleteDocument(docId))
}
