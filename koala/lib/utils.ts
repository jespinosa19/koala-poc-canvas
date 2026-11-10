import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge, fromTheme, validators } from "tailwind-merge"

export function isArbitraryFontFamily(value: string) {
  const match = /^\[(.+)\]$/.exec(value)
  if (!match || /^\w[\w-]*:/.test(match[1])) return false
  const entries = match[1].split(",").map((part) => part.replace(/^_+/, ""))
  if (entries.some((part) => /^\d/.test(part))) return false
  return entries.some((part) => !part.startsWith("var("))
}

export const twMergeConfig = {
  override: {
    classGroups: {
      "font-weight": [
        {
          font: [
            fromTheme("font-weight"),
            validators.isArbitraryVariableWeight,
            (value: string) => validators.isArbitraryWeight(value) && !isArbitraryFontFamily(value),
          ],
        },
      ],
    },
  },
  extend: {
    theme: {
      ease: ["drawer", "spring", "lift", "sine"],
      spacing: ["control-sm", "control-md", "control-lg", "control-xl"],
      "font-weight": ["numeral"],
      tracking: ["figure"],
    },
    classGroups: {
      "font-family": [{ font: ["heading", "figure", isArbitraryFontFamily] }],
      rounded: [{ rounded: ["pill"] }],
      "transition-duration": [{ duration: ["fast", "base", "slow"] }],
      "koala-animation-fill-mode": [{ "fill-mode": ["none", "forwards", "backwards", "both"] }],
      "font-size": ["section-heading"],
      "koala-ring": ["brand-ring", "destructive-ring"],
      "koala-caret": ["caret-turn", "caret-turn-fast"],
      "koala-eyebrow": ["eyebrow", "eyebrow-mono"],
      "koala-fade": [
        "fade",
        "fade-x",
        "fade-t",
        "fade-b",
        "fade-l",
        "fade-r",
        "scroll-fade",
        "scroll-fade-x",
        "scroll-fade-t",
        "scroll-fade-b",
        "scroll-fade-l",
        "scroll-fade-r",
      ],
      "koala-hero-stage": [
        "hero-stage-track",
        "hero-stage-pin",
        "hero-stage-media",
        "hero-stage-exit",
        "hero-stage-letter",
        "hero-stage-enter",
      ],
    },
  },
}

const twMerge = extendTailwindMerge(twMergeConfig)

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
