import * as React from "react"

export function createContext<ContextValue>(rootComponentName: string) {
  const Context = React.createContext<ContextValue | null>(null)
  Context.displayName = `${rootComponentName}Context`

  function Provider({
    children,
    ...value
  }: ContextValue & { children: React.ReactNode }) {
    const memo = React.useMemo(
      () => value as ContextValue,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(value as Record<string, unknown>),
    )
    return <Context.Provider value={memo}>{children}</Context.Provider>
  }

  function useContext(consumerName: string): ContextValue {
    const context = React.useContext(Context)
    if (context === null) {
      throw new Error(
        `\`${consumerName}\` must be used within \`${rootComponentName}.Root\``,
      )
    }
    return context
  }

  return [Provider, useContext] as const
}
