"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

import { Button, type ButtonProps } from "./button"
import { socialProviders, type SocialProvider } from "./social-logos"

export interface SocialButtonProps extends Omit<ButtonProps, "variant" | "children"> {
  provider: SocialProvider
  appearance?: "outline" | "solid"
  children?: React.ReactNode
}

export function SocialButton({
  provider,
  appearance = "outline",
  iconOnly = false,
  className,
  children,
  "aria-label": ariaLabel,
  ...props
}: SocialButtonProps) {
  const { Logo, label, solid } = socialProviders[provider]

  return (
    <Button
      type="button"
      variant="outline"
      iconOnly={iconOnly}
      aria-label={iconOnly ? (ariaLabel ?? `Continue with ${label}`) : ariaLabel}
      className={cn(
        appearance === "solid" && [
          solid,
          "border-transparent text-white hover:text-white",
          "[&_path]:fill-white",
        ],
        className,
      )}
      {...props}
    >
      <Logo className="size-5" />
      {!iconOnly && (children ?? <>Continue with {label}</>)}
    </Button>
  )
}
