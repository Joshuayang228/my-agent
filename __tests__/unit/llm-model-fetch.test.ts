import { describe, expect, it } from 'vitest'
import {
  addConnectionModel,
  enabledConnectionModelIds,
  MODEL_FETCH_MESSAGES,
  normalizeConnectionModels,
  parseRemoteModelList,
  removeConnectionModel,
  setConnectionModelEnabled,
  validateLLMModelFetchInput,
} from '../../src/shared/llm-model-fetch'

describe('LLM model fetch input', () => {
  it('accepts a draft key and normalizes the trailing slash', () => {
    expect(validateLLMModelFetchInput({
      apiKey: 'secret',
      baseUrl: 'https://example.com/v1/',
      provider: 'openai',
    })).toEqual({
      ok: true,
      value: { apiKey: 'secret', baseUrl: 'https://example.com/v1', provider: 'openai' },
    })
  })

  it('rejects missing keys without sending a request shape', () => {
    expect(validateLLMModelFetchInput({ apiKey: '', baseUrl: 'https://example.com/v1' })).toEqual({
      ok: false, error: MODEL_FETCH_MESSAGES.missingKey, reason: 'missing-key',
    })
  })

  it('never echoes the API key in validation errors', () => {
    const result = validateLLMModelFetchInput({ apiKey: 'do-not-leak', baseUrl: 'not-a-url' })
    expect(result).toEqual({ ok: false, error: MODEL_FETCH_MESSAGES.invalidBaseUrl, reason: 'network' })
    expect(JSON.stringify(result)).not.toContain('do-not-leak')
  })

  it('keeps useStoredApiKey and connectionId without requiring a draft key', () => {
    expect(validateLLMModelFetchInput({
      useStoredApiKey: true,
      connectionId: 'conn-1',
      baseUrl: 'https://example.com/v1/',
      provider: 'openai',
    })).toEqual({
      ok: true,
      value: {
        useStoredApiKey: true,
        connectionId: 'conn-1',
        baseUrl: 'https://example.com/v1',
        provider: 'openai',
      },
    })
  })
})

describe('remote model list parsing', () => {
  it('reads OpenAI data.id and Anthropic models.model, then de-duplicates', () => {
    expect(parseRemoteModelList({
      data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }, { id: 'gpt-4o' }],
    })).toEqual(['gpt-4o', 'gpt-4o-mini'])
    expect(parseRemoteModelList({
      models: [{ model: 'claude-sonnet-4' }, { id: 'claude-haiku-4' }],
    })).toEqual(['claude-sonnet-4', 'claude-haiku-4'])
  })
})

describe('connection model list', () => {
  it('migrates a legacy single model into the list and keeps later additions unique', () => {
    const migrated = normalizeConnectionModels({ model: 'gpt-4o' })
    expect(migrated).toEqual([{ id: 'gpt-4o', enabled: true }])
    expect(addConnectionModel({ model: 'gpt-4o', models: migrated }, 'gpt-4o-mini')).toEqual({
      model: 'gpt-4o',
      models: [{ id: 'gpt-4o', enabled: true }, { id: 'gpt-4o-mini', enabled: true }],
    })
    expect(addConnectionModel({ model: 'gpt-4o', models: migrated }, 'gpt-4o').models).toHaveLength(1)
  })

  it('keeps disabled models out of route candidates and falls back after removal', () => {
    const connection = {
      model: 'gpt-4o',
      models: [{ id: 'gpt-4o', enabled: true }, { id: 'gpt-4o-mini', enabled: true }],
    }
    const disabled = setConnectionModelEnabled(connection, 'gpt-4o', false)
    expect(enabledConnectionModelIds(disabled)).toEqual(['gpt-4o-mini'])
    expect(removeConnectionModel(disabled, 'gpt-4o-mini')).toEqual({
      model: 'gpt-4o',
      models: [{ id: 'gpt-4o', enabled: false }],
    })
  })
})
