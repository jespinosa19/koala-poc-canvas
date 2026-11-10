"use client"

import * as React from "react"
import tippy, { createSingleton, sticky } from "tippy.js/headless"
import { createPortal } from "react-dom"
import type { Instance, Props, Content, CreateSingletonInstance } from "tippy.js"

import { tv } from "@/lib/tv"

export const tooltipVariants = tv({
  base: [
    "flex",
    "max-w-xs text-xs text-pretty select-none",
    "transition duration-fast ease-out",
    "data-[state=hidden]:opacity-0",
    "data-[state=visible]:opacity-100",
    "data-[placement^=top]:origin-bottom data-[placement^=bottom]:origin-top",
    "data-[placement^=left]:origin-right data-[placement^=right]:origin-left",
  ],
  variants: {
    variant: {
      text: "items-center justify-center gap-1 rounded-md bg-foreground px-2 py-1 font-medium text-background shadow-md [--surface:var(--foreground)]",
      graph: "flex-col items-start gap-2 rounded-lg border border-border-soft bg-popover px-3 py-2 text-left text-popover-foreground shadow-lg [--surface:var(--popover)]",
    },
    transition: {
      default: [
        "data-[state=hidden]:scale-95 data-[state=visible]:scale-100",
        "data-[placement^=top]:data-[state=hidden]:-translate-y-1",
        "data-[placement^=bottom]:data-[state=hidden]:translate-y-1",
        "data-[placement^=left]:data-[state=hidden]:-translate-x-1",
        "data-[placement^=right]:data-[state=hidden]:translate-x-1",
      ],
      singleton: ["scale-100"],
    },
  },
  defaultVariants: {
    variant: "text",
    transition: "default",
  },
})

type TooltipInstance = Instance & { _koalaCancelExit?: () => void; _koalaPointerFocus?: Element }

let pointerModality = false
let watchingModality = false

function watchModality() {
  if (watchingModality || typeof document === "undefined") return
  watchingModality = true
  const onPointer = () => {
    pointerModality = true
  }
  document.addEventListener("pointerdown", onPointer, true)
  document.addEventListener("mousedown", onPointer, true)
  document.addEventListener(
    "keydown",
    () => {
      pointerModality = false
    },
    true,
  )
}

const focusGate: Pick<Props, "onTrigger" | "onShow"> = {
  onTrigger(instance, event) {
    ;(instance as TooltipInstance)._koalaPointerFocus =
      event.type === "focus" && pointerModality ? (event.currentTarget as Element) : undefined
  },
  onShow(instance) {
    const target = (instance as TooltipInstance)._koalaPointerFocus
    ;(instance as TooltipInstance)._koalaPointerFocus = undefined
    if (target && !target.matches(":hover")) return false
  },
}

const positioning: Pick<Props, "popperOptions" | "plugins" | "sticky"> = {
  popperOptions: { strategy: "fixed" },
  plugins: [sticky],
  sticky: "reference",
}

function mountPoint(): Element {
  return document.fullscreenElement ?? document.body
}

function box(instance: Instance): HTMLElement | null {
  return instance.popper.firstElementChild as HTMLElement | null
}

function handleMount(instance: Instance) {
  ;(instance as TooltipInstance)._koalaCancelExit?.()
  const el = box(instance)
  if (!el) return
  const p = (
    instance as unknown as { popperInstance?: { state?: { placement?: string } } }
  ).popperInstance?.state?.placement
  if (p) el.setAttribute("data-placement", p)
  requestAnimationFrame(() => el.setAttribute("data-state", "visible"))
}

function handleHide(instance: Instance) {
  const el = box(instance)
  if (!el) {
    queueMicrotask(() => instance.unmount())
    return
  }
  el.setAttribute("data-state", "hidden")
  const onEnd = (event: TransitionEvent) => {
    if (event.target !== el || event.propertyName !== "opacity") return
    cancel()
    instance.unmount()
  }
  const cancel = () => el.removeEventListener("transitionend", onEnd)
  ;(instance as TooltipInstance)._koalaCancelExit = cancel
  el.addEventListener("transitionend", onEnd)
}

function TooltipBubble({
  attrs,
  className,
  variant,
  transition,
  children,
}: {
  attrs: Record<string, unknown>
  className?: string
  variant?: "text" | "graph"
  transition?: "default" | "singleton"
  children: React.ReactNode
}) {
  return (
    <div
      role="tooltip"
      data-slot="tooltip"
      data-variant={variant ?? "text"}
      data-state="hidden"
      tabIndex={-1}
      className={tooltipVariants({ className, variant, transition })}
      {...attrs}
    >
      {children}
    </div>
  )
}

type RegisterTrigger = (instance: Instance) => () => void
type TooltipGroupValue = { register: RegisterTrigger; variant: "text" | "graph" }
const TooltipGroupContext = React.createContext<TooltipGroupValue | null>(null)

type CoveredBy = (el: Element) => boolean
const TooltipTriggerContext = React.createContext<CoveredBy | null>(null)

function useCoveredBy(nodeRef: React.RefObject<HTMLElement | null>): CoveredBy {
  const parent = React.useContext(TooltipTriggerContext)
  return React.useCallback(
    (el: Element) => !!nodeRef.current?.contains(el) || !!parent?.(el),
    [nodeRef, parent],
  )
}

export type TooltipAnchor = { x: number; y: number; width?: number; height?: number }

export interface TooltipProps {
  content: React.ReactNode
  children?: React.ReactElement
  open?: boolean
  anchor?: TooltipAnchor
  variant?: "text" | "graph"
  placement?: Props["placement"]
  delay?: Props["delay"]
  offset?: Props["offset"]
  interactive?: boolean
  trigger?: string
  hideOnClick?: boolean
  disabled?: boolean
  auto?: boolean
  className?: string
}

export function Tooltip({
  content,
  children,
  open,
  anchor,
  variant,
  placement = "top",
  delay = [150, 0],
  offset = [0, 6],
  interactive,
  trigger,
  hideOnClick,
  disabled,
  auto,
  className,
}: TooltipProps) {
  const group = React.useContext(TooltipGroupContext)
  const coveredBy = React.useContext(TooltipTriggerContext)
  const joinsGroup =
    group != null &&
    !interactive &&
    !disabled &&
    open === undefined &&
    (variant === undefined || variant === group.variant)

  if (anchor) {
    return (
      <AnchoredTooltip
        content={content}
        anchor={anchor}
        open={open ?? true}
        variant={variant}
        placement={placement}
        offset={offset}
        className={className}
      />
    )
  }
  if (!children) return null

  if (joinsGroup) {
    return (
      <GroupTooltip
        register={group.register}
        content={content}
        placement={placement}
        trigger={trigger}
        hideOnClick={hideOnClick}
        auto={auto}
        coveredBy={coveredBy}
      >
        {children}
      </GroupTooltip>
    )
  }

  return (
    <StandaloneTooltip
      content={content}
      open={open}
      variant={variant}
      placement={placement}
      delay={delay}
      offset={offset}
      interactive={interactive}
      trigger={trigger}
      hideOnClick={hideOnClick}
      disabled={disabled}
      auto={auto}
      coveredBy={coveredBy}
      className={className}
    >
      {children}
    </StandaloneTooltip>
  )
}

function StandaloneTooltip({
  content,
  children,
  open,
  variant,
  placement = "top",
  delay = [150, 0],
  offset = [0, 6],
  interactive,
  trigger,
  hideOnClick,
  disabled,
  auto,
  coveredBy,
  className,
}: TooltipProps & { coveredBy: CoveredBy | null }) {
  const [triggerEl, setTriggerEl] = React.useState<HTMLElement | null>(null)
  const nodeRef = React.useRef<HTMLElement | null>(null)
  const covers = useCoveredBy(nodeRef)
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null)
  const instanceRef = React.useRef<Instance | null>(null)

  const childOrigRefRef = React.useRef<React.Ref<unknown> | undefined>(undefined)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, react-hooks/refs
  childOrigRefRef.current = (children as React.ReactElement<any>).props?.ref

  const triggerRefCallback = React.useCallback((node: HTMLElement | null) => {
    nodeRef.current = node
    setTriggerEl(node)
    const origRef = childOrigRefRef.current
    if (typeof origRef === "function") {
      ;(origRef as (node: HTMLElement | null) => void)(node)
    } else if (origRef != null && typeof origRef === "object") {
      ;(origRef as React.MutableRefObject<HTMLElement | null>).current = node
    }
  }, [])

  React.useEffect(() => {
    if (!triggerEl) return
    if (auto && coveredBy?.(triggerEl)) return
    watchModality()
    const popperEl = document.createElement("div")
    const instance = tippy(triggerEl, {
      render: () => ({ popper: popperEl }),
      ...positioning,
      ...focusGate,
      placement,
      delay: delay as Props["delay"],
      offset: offset as [number, number],
      interactive: interactive ?? false,
      appendTo: mountPoint,
      trigger: open !== undefined ? "manual" : (trigger ?? "mouseenter focus"),
      hideOnClick: open !== undefined ? false : (hideOnClick ?? true),
      animation: true,
      onMount: handleMount,
      onHide: handleHide,
    }) as Instance
    if (disabled) instance.disable()
    instanceRef.current = instance
    const ro = new ResizeObserver(() => instance.popperInstance?.forceUpdate())
    ro.observe(popperEl)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContainer(popperEl)
    return () => {
      ro.disconnect()
      instance.destroy()
      instanceRef.current = null
      setContainer(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerEl])

  React.useEffect(() => {
    const inst = instanceRef.current
    if (!inst) return
    const controlled = open !== undefined
    inst.setProps({
      placement,
      delay: delay as Props["delay"],
      offset: offset as [number, number],
      interactive: interactive ?? false,
      trigger: controlled ? "manual" : (trigger ?? "mouseenter focus"),
      hideOnClick: controlled ? false : (hideOnClick ?? true),
    })
    if (disabled) inst.disable()
    else inst.enable()
  }, [placement, delay, offset, interactive, trigger, hideOnClick, disabled, open])

  React.useEffect(() => {
    const inst = instanceRef.current
    if (!inst || open === undefined) return
    if (open) inst.show()
    else inst.hide()
  }, [open, container])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const triggerNode = React.cloneElement(children as React.ReactElement<any>, { ref: triggerRefCallback })

  return (
    <>
      {auto ? (
        triggerNode
      ) : (
        <TooltipTriggerContext.Provider value={covers}>{triggerNode}</TooltipTriggerContext.Provider>
      )}
      {container &&
        createPortal(
          <TooltipBubble attrs={{}} className={className} variant={variant}>
            {content}
          </TooltipBubble>,
          container,
        )}
    </>
  )
}

function rectOf(a: TooltipAnchor): DOMRect {
  const width = a.width ?? 0
  const height = a.height ?? 0
  return {
    x: a.x,
    y: a.y,
    left: a.x,
    top: a.y,
    right: a.x + width,
    bottom: a.y + height,
    width,
    height,
    toJSON() {
      return this
    },
  } as DOMRect
}

function AnchoredTooltip({
  content,
  anchor,
  open,
  variant,
  placement = "top",
  offset = [0, 6],
  className,
}: {
  content: React.ReactNode
  anchor: TooltipAnchor
  open: boolean
  variant?: "text" | "graph"
  placement?: Props["placement"]
  offset?: Props["offset"]
  className?: string
}) {
  const [reference, setReference] = React.useState<HTMLSpanElement | null>(null)
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null)
  const instanceRef = React.useRef<Instance | null>(null)
  const anchorRef = React.useRef(anchor)

  React.useEffect(() => {
    if (!reference) return
    const popperEl = document.createElement("div")
    popperEl.style.pointerEvents = "none"
    const instance = tippy(reference, {
      render: () => ({ popper: popperEl }),
      popperOptions: positioning.popperOptions,
      getReferenceClientRect: () => rectOf(anchorRef.current),
      placement,
      offset: offset as [number, number],
      trigger: "manual",
      hideOnClick: false,
      interactive: false,
      appendTo: mountPoint,
      animation: true,
      onMount: handleMount,
      onHide: handleHide,
    }) as Instance
    instanceRef.current = instance
    const ro = new ResizeObserver(() => instance.popperInstance?.forceUpdate())
    ro.observe(popperEl)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContainer(popperEl)
    return () => {
      ro.disconnect()
      instance.destroy()
      instanceRef.current = null
      setContainer(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference])

  React.useEffect(() => {
    instanceRef.current?.setProps({ placement, offset: offset as [number, number] })
  }, [placement, offset])

  React.useEffect(() => {
    anchorRef.current = anchor
    instanceRef.current?.popperInstance?.update()
  }, [anchor])

  React.useEffect(() => {
    const inst = instanceRef.current
    if (!inst) return
    if (open) inst.show()
    else inst.hide()
  }, [open, container])

  return (
    <>
      <span
        ref={setReference}
        aria-hidden
        data-slot="tooltip-anchor"
        className="pointer-events-none fixed top-0 left-0 size-0"
      />
      {container &&
        createPortal(
          <TooltipBubble attrs={{}} className={className} variant={variant}>
            {content}
          </TooltipBubble>,
          container,
        )}
    </>
  )
}

function GroupTooltip({
  register,
  content,
  children,
  placement = "top",
  trigger,
  hideOnClick,
  auto,
  coveredBy,
}: {
  register: RegisterTrigger
  content: React.ReactNode
  children: React.ReactElement
  placement?: Props["placement"]
  trigger?: string
  hideOnClick?: Props["hideOnClick"]
  auto?: boolean
  coveredBy: CoveredBy | null
}) {
  const [triggerEl, setTriggerEl] = React.useState<HTMLElement | null>(null)
  const nodeRef = React.useRef<HTMLElement | null>(null)
  const covers = useCoveredBy(nodeRef)
  const instanceRef = React.useRef<Instance | null>(null)

  const childOrigRefRef = React.useRef<React.Ref<unknown> | undefined>(undefined)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, react-hooks/refs
  childOrigRefRef.current = (children as React.ReactElement<any>).props?.ref

  const triggerRefCallback = React.useCallback((node: HTMLElement | null) => {
    nodeRef.current = node
    setTriggerEl(node)
    const origRef = childOrigRefRef.current
    if (typeof origRef === "function") {
      ;(origRef as (node: HTMLElement | null) => void)(node)
    } else if (origRef != null && typeof origRef === "object") {
      ;(origRef as React.MutableRefObject<HTMLElement | null>).current = node
    }
  }, [])

  React.useEffect(() => {
    if (!triggerEl) return
    if (auto && coveredBy?.(triggerEl)) return
    let lastRect: DOMRect | null = null
    const instance = tippy(triggerEl, {
      render: () => ({ popper: document.createElement("div") }),
      content: content as unknown as Content,
      placement,
      trigger: trigger ?? "mouseenter focus",
      hideOnClick: hideOnClick ?? true,
      getReferenceClientRect: () => {
        if (triggerEl.isConnected || !lastRect) lastRect = triggerEl.getBoundingClientRect()
        return lastRect
      },
    }) as Instance
    instanceRef.current = instance
    const unregister = register(instance)
    return () => {
      unregister()
      instance.destroy()
      instanceRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerEl])

  React.useEffect(() => {
    instanceRef.current?.setProps({
      content: content as unknown as Content,
      placement,
      trigger: trigger ?? "mouseenter focus",
      hideOnClick: hideOnClick ?? true,
    })
  }, [content, placement, trigger, hideOnClick])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const triggerNode = React.cloneElement(children as React.ReactElement<any>, { ref: triggerRefCallback })
  return auto ? (
    triggerNode
  ) : (
    <TooltipTriggerContext.Provider value={covers}>{triggerNode}</TooltipTriggerContext.Provider>
  )
}

export interface TooltipGroupProps {
  children: React.ReactNode
  variant?: "text" | "graph"
  delay?: Props["delay"]
  offset?: Props["offset"]
  disabled?: boolean
  className?: string
}

export function TooltipGroup(props: TooltipGroupProps) {
  const parent = React.useContext(TooltipGroupContext)
  const { children, variant, delay, offset, disabled, className } = props
  const joinsParent =
    parent != null &&
    (variant ?? "text") === parent.variant &&
    delay === undefined &&
    offset === undefined &&
    !disabled &&
    className === undefined
  return joinsParent ? children : <TooltipGroupRoot {...props} />
}

function TooltipGroupRoot({
  children,
  variant,
  delay = [150, 200],
  offset = [0, 6],
  disabled,
  className,
}: TooltipGroupProps) {
  const [content, setContent] = React.useState<React.ReactNode>(null)
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null)
  const singletonRef = React.useRef<CreateSingletonInstance | null>(null)
  const instancesRef = React.useRef<Instance[]>([])
  const activeRef = React.useRef<Element | null>(null)

  const syncInstances = React.useCallback(() => {
    singletonRef.current?.setInstances(instancesRef.current)
  }, [])

  const register = React.useCallback<RegisterTrigger>(
    (instance) => {
      instancesRef.current = [...instancesRef.current, instance]
      syncInstances()
      return () => {
        instancesRef.current = instancesRef.current.filter((i) => i !== instance)
        const singleton = singletonRef.current
        if (singleton && activeRef.current === instance.reference) {
          activeRef.current = null
          singleton.clearDelayTimeouts()
          singleton.hide()
        }
        syncInstances()
      }
    },
    [syncInstances],
  )

  React.useEffect(() => {
    watchModality()
    const popperEl = document.createElement("div")
    const singleton = createSingleton(instancesRef.current, {
      ...positioning,
      ...focusGate,
      onTrigger(instance, event) {
        focusGate.onTrigger(instance, event)
        activeRef.current = event.currentTarget as Element
      },
      onHidden() {
        activeRef.current = null
      },
      overrides: ["placement", "getReferenceClientRect", "hideOnClick"],
      delay: delay as Props["delay"],
      offset: offset as [number, number],
      appendTo: mountPoint,
      moveTransition: "transform var(--duration-base) var(--ease-out)",
      onMount: handleMount,
      onHide: handleHide,
      render: () => ({
        popper: popperEl,
        onUpdate: (prev, next) => {
          if (prev.content !== next.content) setContent(next.content as React.ReactNode)
        },
      }),
    })
    if (disabled) singleton.disable()
    singletonRef.current = singleton
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContainer(popperEl)
    return () => {
      singleton.destroy()
      singletonRef.current = null
      setContainer(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    const s = singletonRef.current
    if (!s) return
    s.setProps({ delay: delay as Props["delay"], offset: offset as [number, number] })
    if (disabled) s.disable()
    else s.enable()
  }, [delay, offset, disabled])

  const group = React.useMemo<TooltipGroupValue>(() => ({ register, variant: variant ?? "text" }), [register, variant])

  return (
    <TooltipGroupContext.Provider value={group}>
      {children}
      {container &&
        createPortal(
          <TooltipBubble attrs={{}} className={className} variant={variant} transition="singleton">
            {content}
          </TooltipBubble>,
          container,
        )}
    </TooltipGroupContext.Provider>
  )
}

export const tooltipGraphVariants = tv({
  slots: {
    header: "flex w-full items-start justify-between gap-4",
    headerText: "flex min-w-0 flex-col gap-0.5",
    title: "text-sm font-semibold leading-tight text-balance text-popover-foreground",
    description: "text-xs text-muted-foreground",
    value:
      "inline-flex shrink-0 items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-popover-foreground",
    separator: "h-px w-full bg-border",
    section:
      "relative flex w-full flex-col gap-1.5 pl-3 before:absolute before:inset-y-0.5 before:left-0 before:w-0.5 before:rounded-full before:content-['']",
    stat: "flex items-center gap-2.5",
    statLabel: "min-w-0 flex-1 truncate text-xs text-popover-foreground",
    statPercent: "shrink-0 text-xs tabular-nums text-muted-foreground",
  },
  variants: {
    tone: {
      brand: { section: "before:bg-brand" },
      info: { section: "before:bg-info" },
      success: { section: "before:bg-success" },
      warning: { section: "before:bg-warning" },
      destructive: { section: "before:bg-destructive" },
      neutral: { section: "before:bg-foreground" },
    },
    indent: { true: { stat: "pl-3" } },
  },
  defaultVariants: { tone: "neutral" },
})

export function TooltipHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="tooltip-header" className={tooltipGraphVariants().header({ className })} {...props} />
}

export function TooltipHeaderText({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="tooltip-header-text" className={tooltipGraphVariants().headerText({ className })} {...props} />
  )
}

export function TooltipTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="tooltip-title" className={tooltipGraphVariants().title({ className })} {...props} />
}

export function TooltipDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="tooltip-description" className={tooltipGraphVariants().description({ className })} {...props} />
  )
}

export function TooltipValue({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="tooltip-value" className={tooltipGraphVariants().value({ className })} {...props} />
}

export function TooltipSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="separator"
      data-slot="tooltip-separator"
      className={tooltipGraphVariants().separator({ className })}
      {...props}
    />
  )
}

export type TooltipTone = "brand" | "info" | "success" | "warning" | "destructive" | "neutral"

export interface TooltipSectionProps extends React.ComponentProps<"div"> {
  tone?: TooltipTone
}

export function TooltipSection({ className, tone, ...props }: TooltipSectionProps) {
  return (
    <div data-slot="tooltip-section" className={tooltipGraphVariants({ tone }).section({ className })} {...props} />
  )
}

export interface TooltipStatProps extends Omit<React.ComponentProps<"div">, "children"> {
  label: React.ReactNode
  value: React.ReactNode
  percent?: React.ReactNode
  indent?: boolean
}

export function TooltipStat({ className, label, value, percent, indent, ...props }: TooltipStatProps) {
  const slots = tooltipGraphVariants({ indent })
  return (
    <div data-slot="tooltip-stat" className={slots.stat({ className })} {...props}>
      <span className={slots.statLabel()}>{label}</span>
      {percent != null && <span className={slots.statPercent()}>{percent}</span>}
      <TooltipValue>{value}</TooltipValue>
    </div>
  )
}
