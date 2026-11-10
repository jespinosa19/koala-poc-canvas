"use client"

import * as React from "react"

import { Info } from "koala-icons"

import { tv } from "@/lib/tv"
import { useFieldContext } from "@/lib/field-context"
import { useFieldGroupContext } from "@/lib/field-group-context"
import { Tooltip } from "@/components/ui/tooltip"

const labelVariants = tv({
  slots: {
    root: "flex items-center gap-1 text-sm font-normal text-muted-foreground select-none transition-opacity duration-fast ease-out",
    requiredMark: "text-destructive",
    // Inline with the text, a notch smaller than it, and only as loud as the label until hovered.
    info: [
      "inline-flex shrink-0 cursor-help text-muted-foreground/70",
      "transition-colors duration-fast ease-out hover:text-foreground",
      "[&_svg]:size-3.5",
    ],
    hint: "text-xs text-pretty text-muted-foreground transition-colors duration-fast ease-out",
  },
  variants: {
    disabled: {
      true: { root: "opacity-50" },
    },
    hasError: {
      true: { hint: "text-destructive" },
    },
  },
})

export interface LabelProps extends React.ComponentPropsWithoutRef<"label"> {
  required?: boolean
  disabled?: boolean
  /**
   * Help that would otherwise sit in a hint under the control: shown in a tooltip on an info icon
   * after the label, and still read to screen readers as the control's description.
   */
  info?: React.ReactNode
}

/** The info icon after a label's text. Decorative: the text reaches assistive tech through `LabelInfoText`. */
function LabelInfoIcon({ info }: { info: React.ReactNode }) {
  return (
    <Tooltip content={info}>
      <span data-slot="label-info" aria-hidden="true" className={labelVariants().info()}>
        <Info weight="bold" />
      </span>
    </Tooltip>
  )
}

/**
 * The info text for screen readers. It sits outside the label so it never joins the accessible
 * name, and registers with the field so the control is described by it.
 */
function LabelInfoText({
  owner,
  children,
}: {
  owner: { infoId: string; registerInfo: () => () => void } | null | undefined
  children: React.ReactNode
}) {
  React.useEffect(() => owner?.registerInfo?.(), [owner])
  return (
    <span data-slot="label-info-text" id={owner?.infoId} className="sr-only">
      {children}
    </span>
  )
}

function Label({
  className,
  children,
  required,
  disabled,
  htmlFor,
  id,
  info,
  ...props
}: LabelProps) {
  const field = useFieldContext()
  const resolvedRequired = required ?? field?.required ?? false
  const resolvedDisabled = disabled ?? field?.disabled ?? false
  const { root, requiredMark } = labelVariants({ disabled: resolvedDisabled })
  React.useEffect(() => field?.registerLabel?.(), [field])
  const hasInfo = info != null && info !== false

  return (
    <>
    <label
      data-slot="label"
      id={id ?? field?.labelId}
      htmlFor={htmlFor ?? field?.id}
      className={root({ className })}
      {...props}
    >
      {children}
      {resolvedRequired ? (
        <>
          <span aria-hidden="true" className={requiredMark()}>
            *
          </span>
          <span className="sr-only">(required)</span>
        </>
      ) : null}
      {hasInfo ? <LabelInfoIcon info={info} /> : null}
    </label>
    {hasInfo ? <LabelInfoText owner={field}>{info}</LabelInfoText> : null}
    </>
  )
}

export interface HintProps extends React.ComponentPropsWithoutRef<"p"> {
  hasError?: boolean
}

function Hint({ className, hasError, id, ...props }: HintProps) {
  const field = useFieldContext()
  const group = useFieldGroupContext()
  const owner = field ?? group
  const resolvedError = hasError ?? owner?.hasError ?? false
  React.useEffect(() => owner?.registerHint?.(), [owner])

  return (
    <p
      data-slot="hint"
      id={id ?? owner?.hintId}
      className={labelVariants({ hasError: resolvedError }).hint({ className })}
      {...props}
    />
  )
}

export { Label, Hint, LabelInfoIcon, LabelInfoText, labelVariants }
