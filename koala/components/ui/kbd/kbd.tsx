"use client"

import * as React from "react"
import { Slot } from "radix-ui"

import { tv, type VariantProps } from "@/lib/tv"

export const kbdVariants = tv({
  base: [
    "inline-flex items-center justify-center shrink-0 whitespace-nowrap select-none",
    "border font-mono font-medium tabular-nums",
    "transition duration-fast ease-out",
  ],
  variants: {
    variant: {
      default: [
        "border-transparent bg-foreground/8 text-muted-foreground",
        "[[data-slot=tooltip][data-variant=text]_&]:bg-background/15 [[data-slot=tooltip][data-variant=text]_&]:text-background/80",
      ],
      soft: [
        "border-transparent bg-foreground/8 text-muted-foreground",
        "[[data-slot=tooltip][data-variant=text]_&]:bg-background/15 [[data-slot=tooltip][data-variant=text]_&]:text-background/80",
      ],
      outline: [
        "border-input bg-transparent text-muted-foreground",
        "[[data-slot=tooltip][data-variant=text]_&]:border-background/25 [[data-slot=tooltip][data-variant=text]_&]:text-background/80",
      ],
      solid: [
        "border-transparent bg-foreground text-background shadow-xs",
        "[[data-slot=tooltip][data-variant=text]_&]:bg-background [[data-slot=tooltip][data-variant=text]_&]:text-foreground",
      ],
      ghost: [
        "border-transparent bg-transparent text-muted-foreground shadow-none",
        "[[data-slot=tooltip][data-variant=text]_&]:text-background/70",
      ],
    },
    size: {
      sm: "h-5 min-w-5 gap-0.5 px-1 text-xs rounded-[5px] [&>svg]:size-3",
      md: "h-6 min-w-6 gap-1 px-1.5 text-xs rounded-[6px] [&>svg]:size-3.5",
      lg: "h-7 min-w-7 gap-1 px-2 text-sm rounded-[7px] [&>svg]:size-4",
    },
  },
  compoundVariants: [
    {
      variant: "ghost",
      size: ["sm", "md", "lg"],
      class: "h-auto min-w-0 px-0",
    },
  ],
  defaultVariants: {
    variant: "default",
    size: "md",
  },
})

export interface KbdProps
  extends React.ComponentProps<"kbd">,
    VariantProps<typeof kbdVariants> {
  asChild?: boolean
}

export function Kbd({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: KbdProps) {
  const Comp = asChild ? Slot.Root : "kbd"

  return (
    <Comp
      data-slot="kbd"
      className={kbdVariants({ variant, size, className })}
      {...props}
    />
  )
}
