"use client"

import * as React from "react"
import { Slot } from "radix-ui"

import { useButtonSize, useTouch, type Density } from "@/lib/density"
import { cn } from "@/lib/utils"
import { type VariantProps } from "@/lib/tv"
import { AnimatedLabel } from "@/components/ui/animated-label"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, type TooltipProps } from "@/components/ui/tooltip/tooltip"

declare const process: { env: { NODE_ENV?: string } }

import { buttonVariants } from "./button-variants"

export { buttonVariants }

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  density?: Density
  asChild?: boolean
  static?: boolean
  loading?: boolean
  swapKey?: React.Key
  tooltip?: React.ReactNode | false
  tooltipPlacement?: TooltipProps["placement"]
}

export function Button({
  className,
  variant,
  size,
  iconOnly,
  tone,
  density,
  asChild = false,
  static: isStatic = false,
  loading = false,
  swapKey,
  tooltip,
  tooltipPlacement,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"
  const touch = useTouch()

  const isLoading = loading && !asChild

  const ariaLabel = props["aria-label"]
  const ariaLabelledby = props["aria-labelledby"]
  React.useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      iconOnly &&
      !asChild &&
      !ariaLabel &&
      !ariaLabelledby
    ) {
      console.warn(
        "Button: an `iconOnly` button has no accessible name. Pass `aria-label` " +
          "(or `aria-labelledby`) so assistive tech can announce it.",
      )
    }
  }, [iconOnly, asChild, ariaLabel, ariaLabelledby])

  const button = (
    <Comp
      data-slot="button"
      data-icon-only={iconOnly || undefined}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      data-loading={isLoading || undefined}
      className={buttonVariants({
        variant,
        tone,
        touch,
        size: useButtonSize(size ?? undefined, density),
        iconOnly,
        className: cn(isStatic && "active:scale-100", isLoading && "relative", className),
      })}
      {...props}
    >
      {isLoading ? (
        <>
          <Spinner aria-hidden className="absolute inset-0 m-auto" />
          <span data-slot="button-label" className="inline-flex items-center [gap:inherit] opacity-0">
            {children}
          </span>
        </>
      ) : swapKey !== undefined && !asChild ? (
        <AnimatedLabel swapKey={swapKey} data-slot="button-label">
          {children}
        </AnimatedLabel>
      ) : (
        children
      )}
    </Comp>
  )

  const tooltipContent = tooltip === false ? null : (tooltip ?? ariaLabel)
  if (iconOnly && !asChild && tooltipContent) {
    return (
      <Tooltip auto content={tooltipContent} placement={tooltipPlacement ?? "top"}>
        {button}
      </Tooltip>
    )
  }

  return button
}
