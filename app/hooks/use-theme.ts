/**
 * Source: https://github.com/openai/openai-apps-sdk-examples/tree/main/src
 */

import { useOpenAIGlobal } from "./use-openai-global";
import { Theme } from "./types";

/**
 * Hook to get the current theme from ChatGPT host.
 * 
 * @returns The current theme ("light" or "dark") or null if not available
 * 
 * @example
 * ```tsx
 * const theme = useTheme();
 * console.log(theme); // "light" or "dark"
 * ```
 */
export function useTheme(): Theme | null {
  return useOpenAIGlobal("theme");
}

