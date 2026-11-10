"use client"

import * as React from "react"

export interface FieldContextValue {
  id: string
  labelId: string
  labelledBy: string | undefined
  registerLabel: () => () => void
  describedBy: string | undefined
  hintId: string
  registerHint: () => () => void
  /** The id of a label's `info` text, which joins `describedBy` while it is rendered. */
  infoId: string
  registerInfo: () => () => void
  hasError: boolean
  disabled: boolean
  required: boolean
}

const FieldContext = React.createContext<FieldContextValue | null>(null)
FieldContext.displayName = "FieldContext"

export const FieldContextProvider = FieldContext.Provider

export function useFieldContext(): FieldContextValue | null {
  return React.useContext(FieldContext)
}
