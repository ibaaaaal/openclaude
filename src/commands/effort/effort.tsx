import { c as _c } from "react-compiler-runtime";
import * as React from 'react';
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from '../../services/analytics/index.js';
import { useAppState, useSetAppState } from '../../state/AppState.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';
import { type EffortValue, getAvailableEffortLevels, getDisplayedEffortLevel, getEffortEnvOverride, getEffortLevelDescription, getEffortLevelForDisplay, getEffortValueDescription, isEffortLevel, isOpenAIEffortLevel, modelSupportsEffort, modelUsesOpenAIEffort, openAIEffortToStandard, toPersistableEffort } from '../../utils/effort.js';
import { EffortPicker } from '../../components/EffortPicker.js';
import { updateSettingsForSource } from '../../utils/settings/settings.js';
const COMMON_HELP_ARGS = ['help', '-h', '--help'];
type EffortCommandResult = {
  message: string;
  effortUpdate?: {
    value: EffortValue | undefined;
  };
};
function setEffortValue(effortValue: EffortValue, displayValue?: string, model?: string): EffortCommandResult {
  const persistable = toPersistableEffort(effortValue);
  const requestedValue = displayValue ?? (model && typeof effortValue === 'string' ? String(getEffortLevelForDisplay(model, effortValue)) : String(effortValue));
  if (persistable !== undefined) {
    const result = updateSettingsForSource('userSettings', {
      effortLevel: persistable
    });
    if (result.error) {
      return {
        message: `Failed to set effort level: ${result.error.message}`
      };
    }
  }
  logEvent('tengu_effort_command', {
    effort: effortValue as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
  });

  // Env var wins at resolveAppliedEffort time. Only flag it when it actually
  // conflicts — if env matches what the user just asked for, the outcome is
  // the same, so "Set effort to X" is true and the note is noise.
  const envOverride = getEffortEnvOverride();
  if (envOverride !== undefined && envOverride !== effortValue) {
    const envRaw = process.env.CLAUDE_CODE_EFFORT_LEVEL;
    if (persistable === undefined) {
      return {
        message: `Not applied: CLAUDE_CODE_EFFORT_LEVEL=${envRaw} overrides effort this session, and ${requestedValue} is session-only (nothing saved)`,
        effortUpdate: {
          value: effortValue
        }
      };
    }
    return {
      message: `CLAUDE_CODE_EFFORT_LEVEL=${envRaw} overrides this session — clear it and ${requestedValue} takes over`,
      effortUpdate: {
        value: effortValue
      }
    };
  }
  const description = requestedValue === 'xhigh' ? getEffortLevelDescription('xhigh') : getEffortValueDescription(effortValue);
  const suffix = persistable !== undefined ? '' : ' (this session only)';
  return {
    message: `Set effort level to ${requestedValue}${suffix}: ${description}`,
    effortUpdate: {
      value: effortValue
    }
  };
}
export function showCurrentEffort(appStateEffort: EffortValue | undefined, model: string): EffortCommandResult {
  const envOverride = getEffortEnvOverride();
  const effectiveValue = envOverride === null ? undefined : envOverride ?? appStateEffort;
  if (effectiveValue === undefined) {
    const level = getDisplayedEffortLevel(model, appStateEffort);
    const displayLevel = getEffortLevelForDisplay(model, level);
    return {
      message: `Effort level: auto (currently ${displayLevel})`
    };
  }
  const displayValue = typeof effectiveValue === 'string' ? getEffortLevelForDisplay(model, effectiveValue) : effectiveValue;
  const description = displayValue === 'xhigh' ? getEffortLevelDescription('xhigh') : getEffortValueDescription(effectiveValue);
  return {
    message: `Current effort level: ${displayValue} (${description})`
  };
}
function unsetEffortLevel(): EffortCommandResult {
  const result = updateSettingsForSource('userSettings', {
    effortLevel: undefined
  });
  if (result.error) {
    return {
      message: `Failed to set effort level: ${result.error.message}`
    };
  }
  logEvent('tengu_effort_command', {
    effort: 'auto' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
  });
  // env=auto/unset (null) matches what /effort auto asks for, so only warn
  // when env is pinning a specific level that will keep overriding.
  const envOverride = getEffortEnvOverride();
  if (envOverride !== undefined && envOverride !== null) {
    const envRaw = process.env.CLAUDE_CODE_EFFORT_LEVEL;
    return {
      message: `Cleared effort from settings, but CLAUDE_CODE_EFFORT_LEVEL=${envRaw} still controls this session`,
      effortUpdate: {
        value: undefined
      }
    };
  }
  return {
    message: 'Effort level set to auto',
    effortUpdate: {
      value: undefined
    }
  };
}
export function executeEffort(args: string, model?: string): EffortCommandResult {
  const normalized = args.toLowerCase();
  if (normalized === 'auto' || normalized === 'unset') {
    return unsetEffortLevel();
  }
  const recognized = isEffortLevel(normalized) || isOpenAIEffortLevel(normalized);
  if (model !== undefined && !modelSupportsEffort(model)) {
    return {
      message: `Effort not supported for ${model}`
    };
  }
  if (model !== undefined && recognized && !isRequestedEffortAvailable(normalized, model)) {
    return {
      message: `Invalid argument: ${args}. Valid options are: ${getValidEffortOptions(model).join(', ')}`
    };
  }
  if (isEffortLevel(normalized)) {
    return setEffortValue(normalized, undefined, model);
  }
  if (isOpenAIEffortLevel(normalized)) {
    return setEffortValue(openAIEffortToStandard(normalized), normalized, model);
  }
  return {
    message: `Invalid argument: ${args}. Valid options are: ${getValidEffortOptions(model).join(', ')}`
  };
}
function ShowCurrentEffort(t0) {
  const {
    onDone
  } = t0;
  const effortValue = useAppState(_temp);
  const model = useMainLoopModel();
  const {
    message
  } = showCurrentEffort(effortValue, model);
  onDone(message);
  return null;
}
function _temp(s) {
  return s.effortValue;
}
function ApplyEffortAndClose({
  args,
  onDone
}: {
  args: string;
  onDone: LocalJSXCommandOnDone;
}) {
  const setAppState = useSetAppState();
  const model = useMainLoopModel();
  React.useEffect(() => {
    const result = executeEffort(args, model);
    if (result.effortUpdate) {
      setAppState(prev => ({
        ...prev,
        effortValue: result.effortUpdate?.value
      }));
    }
    onDone(result.message);
  }, [args, model, onDone, setAppState]);
  return null;
}
function getValidEffortOptions(model?: string): string[] {
  if (model !== undefined) {
    const levels = getAvailableEffortLevels(model).map(String);
    return levels.length > 0 ? [...levels, 'auto'] : ['auto'];
  }
  return modelUsesOpenAIEffort(model ?? '')
    ? ['low', 'medium', 'high', 'xhigh', 'auto']
    : ['low', 'medium', 'high', 'max', 'auto'];
}
function isRequestedEffortAvailable(value: string, model: string): boolean {
  const levels = getAvailableEffortLevels(model).map(String);
  if (levels.includes(value)) {
    return true;
  }
  // Codex/OpenAI store xhigh internally as max, so keep /effort max working
  // as an alias when the model exposes xhigh.
  return value === 'max' && levels.includes('xhigh');
}
export function getEffortHelp(model?: string): string {
  const validOptions = getValidEffortOptions(model);
  if (model !== undefined && !modelSupportsEffort(model)) {
    return `Usage: /effort [${validOptions.join('|')}]\n\nEffort not supported for ${model}\n- auto: Use the default effort level for your model`;
  }

  const levelLines = [
    '- low: Quick, straightforward implementation',
    '- medium: Balanced approach with standard testing',
    '- high: Comprehensive implementation with extensive testing',
  ];
  if (validOptions.includes('max')) {
    levelLines.push('- max: Maximum capability with deepest reasoning (Opus 4.6 only)');
  }
  if (validOptions.includes('xhigh')) {
    levelLines.push('- xhigh: Extra high reasoning effort for OpenAI/Codex');
  }
  return `Usage: /effort [${validOptions.join('|')}]\n\nEffort levels:\n${levelLines.join('\n')}\n- auto: Use the default effort level for your model`;
}
export async function call(onDone: LocalJSXCommandOnDone, _context: unknown, args?: string): Promise<React.ReactNode> {
  args = args?.trim() || '';
  if (COMMON_HELP_ARGS.includes(args)) {
    onDone(getEffortHelp());
    return;
  }
  if (args === 'current' || args === 'status') {
    return <ShowCurrentEffort onDone={onDone} />;
  }
  if (!args) {
    return <EffortPickerWrapper onDone={onDone} />;
  }
  return <ApplyEffortAndClose args={args} onDone={onDone} />;
}

function EffortPickerWrapper({ onDone }: { onDone: LocalJSXCommandOnDone }) {
  const setAppState = useSetAppState();
  const model = useMainLoopModel();

  function handleSelect(effort: EffortValue | undefined) {
    const persistable = toPersistableEffort(effort);
    if (persistable !== undefined) {
      updateSettingsForSource('userSettings', {
        effortLevel: persistable
      });
    }
    logEvent('tengu_effort_command', {
      effort: (effort ?? 'auto') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    });
    setAppState(prev => ({
      ...prev,
      effortValue: effort
    }));
    const displayEffort = effort && typeof effort === 'string' ? getEffortLevelForDisplay(model, effort) : effort;
    const description = displayEffort === 'xhigh' ? getEffortLevelDescription('xhigh') : effort ? getEffortValueDescription(effort) : 'Use default effort level for your model';
    const suffix = persistable !== undefined ? '' : ' (this session only)';
    onDone(`Set effort level to ${displayEffort ?? 'auto'}${suffix}: ${description}`);
  }

  function handleCancel() {
    onDone('Cancelled');
  }

  return <EffortPicker onSelect={handleSelect} onCancel={handleCancel} />;
}
