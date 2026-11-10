"use client"

import * as React from "react"
import { Toggle as TogglePrimitive } from "radix-ui"

import { useButtonSize } from "@/lib/density"
import { tv, type VariantProps } from "@/lib/tv"
import { hitBox, hitCoarse, hitY } from "@/lib/hit-area"

export const toggleItemBase = [
  "relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--button-radius,var(--button-corner))] border border-input bg-[var(--surface,var(--background))] font-medium text-muted-foreground",
  "data-[state=off]:hover:bg-accent data-[state=off]:hover:text-accent-foreground",
  "data-[state=on]:border-primary data-[state=on]:text-foreground data-[state=on]:ring-2 data-[state=on]:ring-primary/10",
  "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:pointer-events-none disabled:opacity-50",
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
]

const glyph =
  "col-start-1 row-start-1 flex items-center justify-center transition-[opacity,scale,filter] duration-base ease-out motion-reduce:transition-none"

export const toggleVariants = tv({
  slots: {
    root: [
      "group/toggle",
      ...toggleItemBase,
      "transition-[color,background-color,border-color,box-shadow] duration-fast ease-out",
    ],
    icon: "inline-grid shrink-0 place-items-center",
    iconOff: [
      glyph,
      "group-data-[state=on]/toggle:scale-25 group-data-[state=on]/toggle:opacity-0 group-data-[state=on]/toggle:blur-xs",
    ],
    iconOn: [
      glyph,
      "scale-25 opacity-0 blur-xs",
      "group-data-[state=on]/toggle:scale-100 group-data-[state=on]/toggle:opacity-100 group-data-[state=on]/toggle:blur-none",
    ],
  },
  variants: {
    variant: {
      outline: {},
      ghost: {
        root: [
          "border-transparent bg-transparent",
          "data-[state=on]:border-transparent data-[state=on]:bg-accent data-[state=on]:font-medium data-[state=on]:ring-0",
        ],
      },
    },
    size: {
      sm: { root: "h-control-sm [--button-corner:var(--radius-md)] px-3 text-sm has-[>svg]:px-2.5 has-[>[data-slot=toggle-icon]]:px-2.5" },
      md: { root: `h-control-md [--button-corner:calc(var(--radius)*0.875)] px-4 text-sm has-[>svg]:px-3 has-[>[data-slot=toggle-icon]]:px-3 ${hitCoarse}` },
      lg: { root: `h-control-lg [--button-corner:var(--radius-lg)] px-5 text-sm has-[>svg]:px-4 has-[>[data-slot=toggle-icon]]:px-4 ${hitCoarse}` },
      xl: { root: "h-control-xl [--button-corner:calc(var(--radius)*1.125)] px-6 text-base has-[>svg]:px-5 has-[>[data-slot=toggle-icon]]:px-5 [&_svg:not([class*='size-'])]:size-5" },
    },
    iconOnly: {
      true: { root: "px-0 has-[>svg]:px-0 has-[>[data-slot=toggle-icon]]:px-0" },
      false: {},
    },
  },
  compoundVariants: [
    { size: "sm", iconOnly: false, className: { root: hitY } },
    { size: "sm", iconOnly: true, className: { root: `w-control-sm ${hitBox}` } },
    { size: "md", iconOnly: true, className: { root: "w-control-md" } },
    { size: "lg", iconOnly: true, className: { root: "w-control-lg" } },
    { size: "xl", iconOnly: true, className: { root: "w-control-xl" } },
  ],
  defaultVariants: { variant: "outline", size: "md", iconOnly: false },
})

export interface ToggleProps
  extends React.ComponentProps<typeof TogglePrimitive.Root>,
    VariantProps<typeof toggleVariants> {}

export function Toggle({ className, variant, size, iconOnly, ...props }: ToggleProps) {
  const resolved = useButtonSize(size)
  const { root } = toggleVariants({ variant, size: resolved === "xs" ? "sm" : resolved, iconOnly })
  return <TogglePrimitive.Root data-slot="toggle" className={root({ className })} {...props} />
}

export interface ToggleIconProps extends Omit<React.ComponentProps<"span">, "children"> {
  off: React.ReactNode
  on: React.ReactNode
}

export function ToggleIcon({ off, on, className, ...props }: ToggleIconProps) {
  const slots = toggleVariants()
  return (
    <span data-slot="toggle-icon" aria-hidden className={slots.icon({ className })} {...props}>
      <span data-slot="toggle-icon-off" className={slots.iconOff()}>
        {off}
      </span>
      <span data-slot="toggle-icon-on" className={slots.iconOn()}>
        {on}
      </span>
    </span>
  )
}
