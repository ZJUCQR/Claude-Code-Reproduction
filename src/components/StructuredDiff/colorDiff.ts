import type { SyntaxTheme } from 'color-diff-napi'
import { isEnvDefinedFalsy } from '../../utils/envUtils.js'

const colorDiffModule = (() => {
  try {
    return require('color-diff-napi') as typeof import('color-diff-napi')
  } catch {
    return null
  }
})()

export type ColorModuleUnavailableReason = 'env' | 'missing'

/**
 * Returns a static reason why the color-diff module is unavailable, or null if available.
 * 'env' = disabled via CLAUDE_CODE_SYNTAX_HIGHLIGHT
 *
 * The TS port of color-diff works in all build modes, so the only way to
 * disable it is via the env var.
 */
export function getColorModuleUnavailableReason(): ColorModuleUnavailableReason | null {
  if (isEnvDefinedFalsy(process.env.CLAUDE_CODE_SYNTAX_HIGHLIGHT)) {
    return 'env'
  }
  if (!colorDiffModule) {
    return 'missing'
  }
  return null
}

export function expectColorDiff(): typeof import('color-diff-napi').ColorDiff | null {
  return getColorModuleUnavailableReason() === null
    ? colorDiffModule!.ColorDiff
    : null
}

export function expectColorFile(): typeof import('color-diff-napi').ColorFile | null {
  return getColorModuleUnavailableReason() === null
    ? colorDiffModule!.ColorFile
    : null
}

export function getSyntaxTheme(themeName: string): SyntaxTheme | null {
  return getColorModuleUnavailableReason() === null
    ? colorDiffModule!.getSyntaxTheme(themeName)
    : null
}
