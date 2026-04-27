import { afterEach, expect, mock, test } from 'bun:test'

afterEach(() => {
  mock.restore()
})

async function importFreshEffortModule(options: {
  provider: 'codex' | 'openai'
}) {
  mock.module('./model/providers.js', () => ({
    getAPIProvider: () => options.provider,
    getAPIProviderForStatsig: () => options.provider,
    isFirstPartyAnthropicBaseUrl: () => true,
    isGithubNativeAnthropicMode: () => false,
  }))
  mock.module('./model/modelSupportOverrides.js', () => ({
    get3PModelCapabilityOverride: () => undefined,
  }))

  return import(`./effort.js?ts=${Date.now()}-${Math.random()}`)
}

test('gpt-5.4 on the ChatGPT Codex backend supports effort selection', async () => {
  const { getAvailableEffortLevels, modelSupportsEffort } =
    await importFreshEffortModule({
      provider: 'codex',
    })

  expect(modelSupportsEffort('gpt-5.4')).toBe(true)
  expect(getAvailableEffortLevels('gpt-5.4')).toEqual([
    'low',
    'medium',
    'high',
    'xhigh',
  ])
})

test('gpt-5.4 on the OpenAI provider still supports effort selection', async () => {
  const { getAvailableEffortLevels, modelSupportsEffort } =
    await importFreshEffortModule({
      provider: 'openai',
    })

  expect(modelSupportsEffort('gpt-5.4')).toBe(true)
  expect(getAvailableEffortLevels('gpt-5.4')).toEqual([
    'low',
    'medium',
    'high',
    'xhigh',
  ])
})

test('xhigh parses and persists as the internal max level for Codex', async () => {
  const { parseEffortValue, toPersistableEffort } =
    await importFreshEffortModule({
      provider: 'codex',
    })

  const parsed = parseEffortValue('xhigh')
  expect(parsed).toBe('max')
  expect(toPersistableEffort(parsed)).toBe('max')
})

test('Codex xhigh stored as max is not downgraded to high', async () => {
  const { resolveAppliedEffort } = await importFreshEffortModule({
    provider: 'codex',
  })

  expect(resolveAppliedEffort('gpt-5.4', 'max')).toBe('max')
})

test('gpt-5.3-codex-spark stays without effort controls', async () => {
  const { getAvailableEffortLevels, modelSupportsEffort } =
    await importFreshEffortModule({
      provider: 'codex',
    })

  expect(modelSupportsEffort('gpt-5.3-codex-spark')).toBe(false)
  expect(getAvailableEffortLevels('gpt-5.3-codex-spark')).toEqual([])
})
