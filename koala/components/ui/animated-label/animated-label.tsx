"use client"

import * as React from "react"

import { tv, type VariantProps } from "@/lib/tv"

export const animatedLabelVariants = tv({
  slots: {
    root: "relative inline-flex items-center [gap:inherit] motion-safe:transition-[width] motion-safe:duration-base motion-safe:ease-out",
    incoming: "inline-flex shrink-0 items-center whitespace-pre [gap:inherit]",
    outgoing: "label-swap-out absolute inset-0 flex items-center [gap:inherit] opacity-0",
    snapshot: "inline-flex w-max shrink-0 items-center whitespace-pre [gap:inherit]",
  },
  variants: {
    align: {
      start: { root: "justify-start", outgoing: "justify-start" },
      center: { root: "justify-center", outgoing: "justify-center" },
      end: { root: "justify-end", outgoing: "justify-end" },
    },
  },
  defaultVariants: {
    align: "center",
  },
})

export interface AnimatedLabelProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof animatedLabelVariants> {
  swapKey: React.Key
}

export function AnimatedLabel({
  swapKey,
  align,
  className,
  children,
  ...props
}: AnimatedLabelProps) {
  const slots = animatedLabelVariants({ align })

  const [state, setState] = React.useState<{
    key: React.Key
    node: React.ReactNode
    prev: React.ReactNode | null
    seq: number
  }>(() => ({ key: swapKey, node: children, prev: null, seq: 0 }))

  if (!Object.is(state.key, swapKey)) {
    setState((s) => ({ key: swapKey, node: children, prev: s.node, seq: s.seq + 1 }))
  }

  const rootRef = React.useRef<HTMLSpanElement>(null)
  const snapshotRef = React.useRef<HTMLSpanElement>(null)

  React.useLayoutEffect(() => {
    const el = rootRef.current
    const snapshot = snapshotRef.current
    if (!el || !snapshot) return

    const pinned = el.style.width !== ""
    const from = pinned ? el.offsetWidth : snapshot.offsetWidth
    if (pinned) el.style.width = ""
    const to = el.offsetWidth

    if (Math.abs(from - to) < 1) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    el.style.width = `${from}px`
    el.getBoundingClientRect()
    el.style.width = `${to}px`

    const release = () => {
      el.style.width = ""
    }
    el.addEventListener("transitionend", release, { once: true })
    return () => el.removeEventListener("transitionend", release)
  }, [state.seq])

  return (
    <span ref={rootRef} data-slot="animated-label" className={slots.root({ className })} {...props}>
      <span
        key={`in-${state.seq}`}
        className={slots.incoming({ className: state.seq > 0 ? "label-swap-in" : undefined })}
      >
        {children}
      </span>
      {state.prev != null && (
        <span
          key={`out-${state.seq}`}
          aria-hidden
          className={slots.outgoing()}
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) setState((s) => ({ ...s, prev: null }))
          }}
        >
          <span ref={snapshotRef} className={slots.snapshot()}>
            {state.prev}
          </span>
        </span>
      )}
    </span>
  )
}
