"use client"

import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { tv } from "@/lib/tv"
import { useFieldContext } from "@/lib/field-context"
import { hitX } from "@/lib/hit-area"

export const switchVariants = tv({
  slots: {
    root: [
      "peer inline-flex shrink-0 cursor-pointer items-center rounded-full p-0.5",
      "h-5 w-9",
      hitX,
      "transition-colors duration-fast ease-out",
      "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "bg-input data-[state=checked]:bg-primary",
      "disabled:cursor-not-allowed disabled:opacity-50",
    ],
    thumb: [
      "pointer-events-none block size-4 rounded-full bg-background shadow-sm",
      "transition-transform duration-fast ease-out",
      "data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-4",
    ],
  },
})

export interface SwitchProps extends React.ComponentProps<typeof SwitchPrimitive.Root> {
  static?: boolean
}

export function Switch({
  className,
  static: isStatic = false,
  id,
  disabled,
  "aria-describedby": ariaDescribedBy,
  ...props
}: SwitchProps) {
  const { root, thumb } = switchVariants()
  const field = useFieldContext()
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      id={id ?? field?.id}
      disabled={disabled ?? field?.disabled}
      aria-describedby={ariaDescribedBy ?? field?.describedBy}
      className={root({ className: cn(isStatic && "active:scale-100", className) })}
      {...props}
    >
      <SwitchPrimitive.Thumb data-slot="switch-thumb" className={thumb()} />
    </SwitchPrimitive.Root>
  )
}

export interface SwitchIndicatorProps extends React.ComponentProps<"span"> {
  checked: boolean
}

export function SwitchIndicator({ checked, className, ...props }: SwitchIndicatorProps) {
  const { root, thumb } = switchVariants()
  const state = checked ? "checked" : "unchecked"
  return (
    <span
      aria-hidden
      data-slot="switch-indicator"
      data-state={state}
      className={root({ className: cn("pointer-events-none active:scale-100", className) })}
      {...props}
    >
      <span data-state={state} className={thumb()} />
    </span>
  )
}
