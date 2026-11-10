"use client"

import * as React from "react"

export interface FieldGroupContextValue {
  hintId: string
  describedBy: string | undefined
  registerHint: () => () => void
  /** The id of a label's `info` text, which joins `describedBy` while it is rendered. */
  infoId: string
  registerInfo: () => () => void
  hasError: boolean
  disabled: boolean
  required: boolean
}

const FieldGroupContext = React.createContext<FieldGroupContextValue | null>(null)
FieldGroupContext.displayName = "FieldGroupContext"

export const FieldGroupContextProvider = FieldGroupContext.Provider

export function useFieldGroupContext(): FieldGroupContextValue | null {
  return React.useContext(FieldGroupContext)
}
