"use client"

import * as React from "react"

export type Density = "comfortable" | "compact"

export type SurfaceDensity = Density | "touch"

const DensityContext = React.createContext<SurfaceDensity>("compact")
DensityContext.displayName = "DensityContext"

export function DensityProvider({
  density,
  children,
}: {
  density: SurfaceDensity
  children: React.ReactNode
}) {
  return (
    <DensityContext.Provider value={density}>
      <div data-density={density} className="contents">
        {children}
      </div>
    </DensityContext.Provider>
  )
}

function toDensity(density: SurfaceDensity): Density {
  return density === "touch" ? "comfortable" : density
}

export function useDensity(density?: Density): Density {
  const context = React.useContext(DensityContext)
  return density ?? toDensity(context)
}

export function useTouch(): boolean {
  return React.useContext(DensityContext) === "touch"
}

export type Domain = "application" | "marketing"

const DomainContext = React.createContext<Domain>("application")
DomainContext.displayName = "DomainContext"

export function DomainProvider({ domain, children }: { domain: Domain; children: React.ReactNode }) {
  return <DomainContext.Provider value={domain}>{children}</DomainContext.Provider>
}

export function useDomain(): Domain {
  return React.useContext(DomainContext)
}

export type ControlSize = "sm" | "md" | "lg"

export type ButtonSize = "xs" | ControlSize | "xl"

const ControlSizeContext = React.createContext<ButtonSize | null>(null)
ControlSizeContext.displayName = "ControlSizeContext"

export function ControlSizeProvider({
  size,
  children,
}: {
  size: ButtonSize
  children: React.ReactNode
}) {
  return <ControlSizeContext.Provider value={size}>{children}</ControlSizeContext.Provider>
}

function toControlSize(size: ButtonSize): ControlSize {
  if (size === "xl") return "lg"
  if (size === "xs") return "sm"
  return size
}

export function useControlSizeContext(): ControlSize | null {
  const size = React.useContext(ControlSizeContext)
  return size ? toControlSize(size) : null
}

export function useControlSize(size?: ControlSize, density?: Density): ControlSize {
  const contextSize = React.useContext(ControlSizeContext)
  const domain = React.useContext(DomainContext)
  if (size) return size
  if (density) return density === "compact" ? "sm" : "md"
  if (contextSize) return toControlSize(contextSize)
  return domain === "marketing" ? "md" : "sm"
}

function resolveButtonSize(
  size: ButtonSize | undefined,
  density: Density | undefined,
  contextSize: ButtonSize | null,
  domain: Domain,
): ButtonSize {
  if (size) return size
  if (density) return density === "compact" ? "sm" : "md"
  if (contextSize) return contextSize
  return domain === "marketing" ? "md" : "sm"
}

export function useButtonSize(size?: ButtonSize, density?: Density): ButtonSize {
  const contextSize = React.useContext(ControlSizeContext)
  const domain = React.useContext(DomainContext)
  const touch = React.useContext(DensityContext) === "touch"
  const resolved = resolveButtonSize(size, density, contextSize, domain)
  return touch && resolved === "xs" ? "sm" : resolved
}
