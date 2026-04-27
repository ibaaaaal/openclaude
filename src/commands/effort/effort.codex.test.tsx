import { afterEach, expect, test } from 'bun:test'

const originalEnv = {
  CLAUDE_CODE_USE_OPENAI: process.env.CLAUDE_CODE_USE_OPENAI,
  CLAUDE_CODE_USE_GEMINI: process.env.CLAUDE_CODE_USE_GEMINI,
  CLAUDE_CODE_USE_GITHUB: process.env.CLAUDE_CODE_USE_GITHUB,
  CLAUDE_CODE_USE_MISTRAL: process.env.CLAUDE_CODE_USE_MISTRAL,
  CLAUDE_CODE_USE_BEDROCK: process.env.CLAUDE_CODE_USE_BEDROCK,
  CLAUDE_CODE_USE_VERTEX: process.env.CLAUDE_CODE_USE_VERTEX,
  CLAUDE_CODE_USE_FOUNDRY: process.env.CLAUDE_CODE_USE_FOUNDRY,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_API_BASE: process.env.OPENAI_API_BASE,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
}

afterEach(() => {
  process.env.CLAUDE_CODE_USE_OPENAI = originalEnv.CLAUDE_CODE_USE_OPENAI
  process.env.CLAUDE_CODE_USE_GEMINI = originalEnv.CLAUDE_CODE_USE_GEMINI
  process.env.CLAUDE_CODE_USE_GITHUB = originalEnv.CLAUDE_CODE_USE_GITHUB
  process.env.CLAUDE_CODE_USE_MISTRAL = originalEnv.CLAUDE_CODE_USE_MISTRAL
  process.env.CLAUDE_CODE_USE_BEDROCK = originalEnv.CLAUDE_CODE_USE_BEDROCK
  process.env.CLAUDE_CODE_USE_VERTEX = originalEnv.CLAUDE_CODE_USE_VERTEX
  process.env.CLAUDE_CODE_USE_FOUNDRY = originalEnv.CLAUDE_CODE_USE_FOUNDRY
  process.env.OPENAI_BASE_URL = originalEnv.OPENAI_BASE_URL
  process.env.OPENAI_API_BASE = originalEnv.OPENAI_API_BASE
  process.env.OPENAI_MODEL = originalEnv.OPENAI_MODEL
})

async function importFreshEffortCommand() {
  return import(`./effort.js?ts=${Date.now()}-${Math.random()}`)
}

function useCodexProviderEnv() {
  process.env.CLAUDE_CODE_USE_OPENAI = '1'
  delete process.env.CLAUDE_CODE_USE_GEMINI
  delete process.env.CLAUDE_CODE_USE_GITHUB
  delete process.env.CLAUDE_CODE_USE_MISTRAL
  delete process.env.CLAUDE_CODE_USE_BEDROCK
  delete process.env.CLAUDE_CODE_USE_VERTEX
  delete process.env.CLAUDE_CODE_USE_FOUNDRY
  delete process.env.OPENAI_API_BASE
  process.env.OPENAI_BASE_URL = 'https://chatgpt.com/backend-api/codex'
  process.env.OPENAI_MODEL = 'codexplan'
}

test('Codex effort help does not leak the Claude max/Opus option', async () => {
  useCodexProviderEnv()

  const { getEffortHelp } = await importFreshEffortCommand()
  const help = getEffortHelp('gpt-5.5')

  expect(help).toContain('xhigh')
  expect(help).not.toContain('Opus')
  expect(help).not.toContain('- max:')
})

test('Codex max alias feedback is displayed as xhigh without Opus wording', async () => {
  useCodexProviderEnv()

  const { executeEffort } = await importFreshEffortCommand()
  const result = executeEffort('max', 'gpt-5.5')

  expect(result.message).toContain('Set effort level to xhigh')
  expect(result.message).not.toContain('Opus')
})

test('Codex models without reasoning effort reject xhigh instead of silently storing it', async () => {
  useCodexProviderEnv()

  const { executeEffort, getEffortHelp } = await importFreshEffortCommand()
  const result = executeEffort('xhigh', 'gpt-5.3-codex-spark')

  expect(result.message).toBe('Effort not supported for gpt-5.3-codex-spark')
  expect(result.effortUpdate).toBeUndefined()
  expect(getEffortHelp('gpt-5.3-codex-spark')).toContain('Usage: /effort [auto]')
  expect(getEffortHelp('gpt-5.3-codex-spark')).not.toContain('xhigh')
})
