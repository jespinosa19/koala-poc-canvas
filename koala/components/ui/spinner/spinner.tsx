"use client"

import type { ComponentProps } from "react"

import { tv, type VariantProps } from "@/lib/tv"

export const spinnerVariants = tv({
  slots: {
    root: "shrink-0 animate-spin motion-reduce:animate-none",
    track: "opacity-25",
    indicator: "",
  },
  variants: {
    size: {
      sm: { root: "size-3.5" },
      md: { root: "size-4" },
      lg: { root: "size-5" },
      xl: { root: "size-10" },
    },
  },
})

export interface SpinnerProps
  extends Omit<ComponentProps<"svg">, "children">,
    VariantProps<typeof spinnerVariants> {
  label?: string
}

export function Spinner({ className, size, label = "Loading", ...props }: SpinnerProps) {
  const hidden = props["aria-hidden"] === true || props["aria-hidden"] === "true"
  const { root, track, indicator } = spinnerVariants({ size })

  return (
    <svg
      data-slot="spinner"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      role={hidden ? undefined : "status"}
      aria-label={hidden ? undefined : label}
      aria-hidden={hidden || undefined}
      className={root({ className })}
      {...props}
    >
      <circle className={track()} cx="12" cy="12" r="9.25" />
      <circle className={indicator()} cx="12" cy="12" r="9.25" pathLength={100} strokeDasharray="25 100" />
    </svg>
  )
}
