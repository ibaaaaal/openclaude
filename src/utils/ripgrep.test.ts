import { afterEach, expect, mock, test } from 'bun:test'

import { wrapRipgrepUnavailableError, ripgrepCommand } from './ripgrep.ts'

const originalEnv = {
  USE_BUILTIN_RIPGREP: process.env.USE_BUILTIN_RIPGREP,
}

afterEach(() => {
  if (originalEnv.USE_BUILTIN_RIPGREP === undefined) {
    delete process.env.USE_BUILTIN_RIPGREP
  } else {
    process.env.USE_BUILTIN_RIPGREP = originalEnv.USE_BUILTIN_RIPGREP
  }

  mock.restore()
})

const MOCK_BUILTIN_PATH =
  process.platform === 'win32'
    ? `vendor/ripgrep/${process.arch}-win32/rg.exe`
    : `vendor/ripgrep/${process.arch}-${process.platform}/rg`

function loadFsModule() {
  return import('fs')
}

function loadFindExecutableModule() {
  return import('./findExecutable.js')
}

function loadRipgrepModule() {
  return import(`./ripgrep.ts?test=${Date.now()}-${Math.random()}`)
}

async function withMockedRipgrepConfig(options: {
  builtinExists: boolean
  systemRgFound: boolean
}) {
  const fsModule = await loadFsModule()
  const findExecutableModule = await loadFindExecutableModule()

  mock.module('fs', () => ({
    ...fsModule,
    existsSync: (target: string) =>
      target.includes(MOCK_BUILTIN_PATH) ? options.builtinExists : fsModule.existsSync(target),
  }))

  mock.module('./findExecutable.js', () => ({
    ...findExecutableModule,
    findExecutable: (_exe: string, args: string[]) => ({
      cmd: options.systemRgFound ? '/usr/bin/rg' : 'rg',
      args,
    }),
  }))

  return loadRipgrepModule()
}

async function getRipgrepCommandWithMocks(options: {
  builtinExists: boolean
  systemRgFound: boolean
}) {
  const module = await withMockedRipgrepConfig(options)
  return module.ripgrepCommand()
}


test('ripgrepCommand falls back to system rg when builtin binary is missing', async () => {
  delete process.env.USE_BUILTIN_RIPGREP

  const command = await getRipgrepCommandWithMocks({
    builtinExists: false,
    systemRgFound: true,
  })

  expect(command).toEqual({
    rgPath: 'rg',
    rgArgs: [],
    argv0: undefined,
  })
})

test('ripgrepCommand keeps builtin mode when bundled binary exists', async () => {
  delete process.env.USE_BUILTIN_RIPGREP

  const command = await getRipgrepCommandWithMocks({
    builtinExists: true,
    systemRgFound: true,
  })

  expect(command.rgPath).toContain(MOCK_BUILTIN_PATH)
  expect(command.rgArgs).toEqual([])
})

test('wrapRipgrepUnavailableError explains missing packaged fallback', () => {
  const error = wrapRipgrepUnavailableError(
    { code: 'ENOENT', message: 'spawn rg ENOENT' },
    { mode: 'builtin', command: 'C:\\fake\\vendor\\ripgrep\\rg.exe' },
    'win32',
  )

  expect(error.name).toBe('RipgrepUnavailableError')
  expect(error.code).toBe('ENOENT')
  expect(error.message).toContain('packaged ripgrep fallback')
  expect(error.message).toContain('winget install BurntSushi.ripgrep.MSVC')
})

test('wrapRipgrepUnavailableError explains missing system ripgrep', () => {
  const error = wrapRipgrepUnavailableError(
    { code: 'ENOENT', message: 'spawn rg ENOENT' },
    { mode: 'system', command: 'rg' },
    'linux',
  )

  expect(error.message).toContain('system ripgrep binary was not found on PATH')
  expect(error.message).toContain('apt install ripgrep')
})
