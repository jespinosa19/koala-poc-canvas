"use client"

import * as React from "react"
import { CaretDown } from "koala-icons"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import { Button, type ButtonProps } from "./button"

export interface SplitButtonProps extends Omit<ButtonProps, "children" | "iconOnly" | "asChild" | "tooltip"> {
  menu: React.ReactNode
  menuLabel?: string
  menuAlign?: React.ComponentProps<typeof DropdownMenuContent>["align"]
  menuClassName?: string
  asChild?: boolean
  children: React.ReactNode
}

export function SplitButton({
  children,
  menu,
  menuLabel = "More options",
  menuAlign = "end",
  menuClassName,
  variant,
  size,
  density,
  tone,
  disabled,
  type = "button",
  asChild = false,
  className,
  ...buttonProps
}: SplitButtonProps) {
  return (
    <div data-slot="split-button" className="inline-flex shrink-0">
      <Button
        {...buttonProps}
        data-slot="split-button-action"
        type={asChild ? undefined : type}
        asChild={asChild}
        variant={variant}
        size={size}
        density={density}
        tone={tone}
        disabled={disabled}
        className={cn(
          "relative rounded-r-none border-r-0 after:absolute after:right-0 after:top-1/4 after:h-1/2 after:w-px after:bg-current/20 after:content-['']",
          className,
        )}
      >
        {children}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            data-slot="split-button-trigger"
            type="button"
            variant={variant}
            size={size}
            density={density}
            tone={tone}
            iconOnly
            tooltip={false}
            aria-label={menuLabel}
            disabled={disabled}
            className="rounded-l-none rounded-r-[var(--button-radius,var(--button-corner))] border-l-0"
          >
            <CaretDown weight="bold" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={menuAlign} density={density} className={menuClassName}>
          {menu}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
