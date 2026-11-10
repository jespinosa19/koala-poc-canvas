"use client"

import * as React from "react"
import { Popover as PopoverPrimitive, Slot } from "radix-ui"

import { tv, type VariantProps } from "@/lib/tv"
import { useDensity } from "@/lib/density"

export const popoverVariants = tv({
  slots: {
    content: [
      "z-50 w-72 rounded-lg bg-popover text-popover-foreground shadow-lg ring-1 ring-border-soft ring-inset outline-none",
      "[--surface:var(--popover)]",
      "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
      "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
      "data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2",
      "data-[state=open]:duration-fast data-[state=closed]:duration-[100ms] ease-out",
      "has-[>[data-slot=popover-viewport]]:w-auto has-[>[data-slot=popover-viewport]]:p-0",
    ],
    arrow: "fill-popover",
    title: "text-base font-semibold leading-none tracking-tight text-foreground",
    description: "text-sm text-muted-foreground",
    media: [
      "relative -mx-2 first:-mt-2 last:-mb-2 [&:has(+span[style]:last-child)]:-mb-2 aspect-video overflow-hidden rounded-(--popover-inset-radius) bg-muted",
      "[&>img]:size-full [&>img]:object-cover [&>video]:size-full [&>video]:object-cover",
      "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-inset after:ring-black/10 dark:after:ring-white/10",
    ],
    footer:
      "-mx-2 mt-3 -mb-2 flex items-center gap-3 rounded-(--popover-inset-radius) bg-muted p-2 text-sm [--surface:var(--muted)]",
    close: [
      "absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-md",
      "text-muted-foreground cursor-pointer transition-[background-color,color,scale] duration-fast ease-out",
      "hover:bg-accent hover:text-foreground",
      "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-popover",
      "[&_svg]:size-4 [&_svg]:shrink-0",
    ],
    viewport: [
      "relative overflow-hidden rounded-[inherit]",
      "transition-[width,height] duration-base ease-out data-instant:transition-none motion-reduce:transition-none",
    ],
    viewportItem: [
      "absolute start-0 top-0 w-max max-w-(--radix-popover-content-available-width) p-(--popover-padding)",
      "data-[motion^=from-]:animate-in data-[motion^=from-]:fade-in-0 data-[motion^=from-]:duration-base",
      "data-[motion^=from-]:delay-[calc(var(--duration-fast)/2)] data-[motion^=from-]:fill-mode-[backwards]",
      "data-[motion=from-right]:slide-in-from-right-4 data-[motion=from-left]:slide-in-from-left-4",
      "data-[motion=from-bottom]:slide-in-from-bottom-2 data-[motion=from-top]:slide-in-from-top-2",
      "data-[motion^=to-]:pointer-events-none data-[motion^=to-]:animate-out data-[motion^=to-]:fade-out-0 data-[motion^=to-]:duration-fast data-[motion^=to-]:fill-mode-[forwards]",
      "data-[motion=to-left]:slide-out-to-left-4 data-[motion=to-right]:slide-out-to-right-4",
      "data-[motion=to-top]:slide-out-to-top-2 data-[motion=to-bottom]:slide-out-to-bottom-2",
      "ease-out motion-reduce:animate-none data-[motion^=to-]:motion-reduce:hidden",
    ],
  },
  variants: {
    density: {
      comfortable: { content: "p-4 [--popover-inset-radius:var(--radius-sm)] [--popover-padding:--spacing(4)]" },
      compact: { content: "p-3 [--popover-inset-radius:var(--radius-md)] [--popover-padding:--spacing(3)]" },
    },
  },
  defaultVariants: { density: "comfortable" },
})

export type PopoverOpenChangeReason =
  | "trigger-press"
  | "trigger-hover"
  | "pointer-leave"
  | "dismiss"
  | "imperative"

export interface PopoverOpenChangeDetails {
  reason: PopoverOpenChangeReason
  triggerId: string | null
  trigger: HTMLElement | null
}

interface HoverOptions {
  openOnHover?: boolean
  delay?: number
  closeDelay?: number
}

interface PopoverSnapshot {
  open: boolean
  activeId: string | null
  contentId: string | undefined
}

interface RootApi {
  press: (id: string) => void
  hoverEnter: (id: string, event: React.PointerEvent, options: HoverOptions) => void
  hoverLeave: (id: string, event: React.PointerEvent, options: HoverOptions) => void
  open: (id: string | null, reason: PopoverOpenChangeReason) => void
  close: (reason: PopoverOpenChangeReason) => void
}

const CLOSED: PopoverSnapshot = { open: false, activeId: null, contentId: undefined }

class PopoverStore {
  snapshot: PopoverSnapshot = CLOSED
  payloads = new Map<string, unknown>()
  customAnchors = 0
  version = 0
  root: RootApi | null = null
  attach(api: RootApi) {
    this.root = api
    return () => {
      if (this.root === api) this.root = null
    }
  }
  private listeners = new Set<() => void>()
  private registryListeners = new Set<() => void>()

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }
  getSnapshot = () => this.snapshot
  getServerSnapshot = () => CLOSED
  publish(next: PopoverSnapshot) {
    const prev = this.snapshot
    if (prev.open === next.open && prev.activeId === next.activeId && prev.contentId === next.contentId) return
    this.snapshot = next
    this.listeners.forEach((listener) => listener())
  }

  subscribeRegistry = (listener: () => void) => {
    this.registryListeners.add(listener)
    return () => void this.registryListeners.delete(listener)
  }
  getVersion = () => this.version
  private bump() {
    this.version++
    this.registryListeners.forEach((listener) => listener())
  }
  register(id: string, payload: unknown) {
    this.payloads.set(id, payload)
    this.bump()
  }
  unregister(id: string) {
    this.payloads.delete(id)
    this.bump()
  }
  setPayload(id: string, payload: unknown) {
    if (!this.payloads.has(id) || Object.is(this.payloads.get(id), payload)) return
    this.payloads.set(id, payload)
    this.bump()
  }
  addCustomAnchor() {
    this.customAnchors++
    this.bump()
    return () => {
      this.customAnchors--
      this.bump()
    }
  }
}

export interface PopoverHandle<Payload = unknown> {
  open: (triggerId?: string) => void
  close: () => void
  readonly isOpen: boolean
  readonly store: PopoverStore
  readonly __payload?: Payload
}

class PopoverHandleImpl<Payload> implements PopoverHandle<Payload> {
  readonly store = new PopoverStore()
  declare readonly __payload?: Payload
  open = (triggerId?: string) => this.store.root?.open(triggerId ?? null, "imperative")
  close = () => this.store.root?.close("imperative")
  get isOpen() {
    return this.store.snapshot.open
  }
}

export function createPopoverHandle<Payload = unknown>(): PopoverHandle<Payload> {
  return new PopoverHandleImpl<Payload>()
}

const StoreContext = React.createContext<PopoverStore | null>(null)

interface PopoverRootContextValue {
  store: PopoverStore
  open: boolean
  activeId: string | null
  payload: unknown
  openedBy: PopoverOpenChangeReason | null
  contentId: string
}
const PopoverRootContext = React.createContext<PopoverRootContextValue | null>(null)

function findTrigger(id: string | null) {
  if (!id || typeof document === "undefined") return null
  return document.querySelector<HTMLElement>(`[data-popover-trigger="${id.replace(/["\\]/g, "\\$&")}"]`)
}

function isTriggerOf(store: PopoverStore, target: EventTarget | null) {
  const trigger = target instanceof Element ? target.closest<HTMLElement>("[data-popover-trigger]") : null
  return !!trigger && store.payloads.has(trigger.dataset.popoverTrigger ?? "")
}

function useControllable<T>(prop: T | undefined, initial: T) {
  const [state, setState] = React.useState(initial)
  return [prop === undefined ? state : prop, setState] as const
}

export interface PopoverProps<Payload = unknown> extends HoverOptions {
  children?: React.ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean, details: PopoverOpenChangeDetails) => void
  triggerId?: string | null
  defaultTriggerId?: string | null
  handle?: PopoverHandle<Payload>
  modal?: boolean
}

export function Popover<Payload = unknown>({
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  triggerId: triggerIdProp,
  defaultTriggerId = null,
  handle,
  modal = false,
  openOnHover = false,
  delay = 300,
  closeDelay = 150,
}: PopoverProps<Payload>) {
  const [ownStore] = React.useState(() => new PopoverStore())
  const store = handle?.store ?? ownStore
  const contentId = React.useId()
  const [open, setOpen] = useControllable(openProp, defaultOpen)
  const [chosenId, setChosenId] = useControllable<string | null>(triggerIdProp, defaultTriggerId)
  const [openedBy, setOpenedBy] = React.useState<PopoverOpenChangeReason | null>(null)
  React.useSyncExternalStore(store.subscribeRegistry, store.getVersion, store.getVersion)

  const firstId: string | null = store.payloads.keys().next().value ?? null
  const activeId = chosenId ?? firstId
  const payload = activeId === null ? undefined : store.payloads.get(activeId)
  const hasCustomAnchor = store.customAnchors > 0

  const latest = React.useRef({ open, activeId, openedBy, onOpenChange, hover: { openOnHover, delay, closeDelay } })
  React.useLayoutEffect(() => {
    latest.current = { open, activeId, openedBy, onOpenChange, hover: { openOnHover, delay, closeDelay } }
    store.publish({ open, activeId, contentId })
  })

  React.useLayoutEffect(() => {
    let openTimer: ReturnType<typeof setTimeout> | undefined
    let closeTimer: ReturnType<typeof setTimeout> | undefined
    const clearTimers = () => {
      clearTimeout(openTimer)
      clearTimeout(closeTimer)
    }
    const details = (reason: PopoverOpenChangeReason, id: string | null): PopoverOpenChangeDetails => ({
      reason,
      triggerId: id,
      trigger: findTrigger(id),
    })
    const openOn = (id: string | null, reason: PopoverOpenChangeReason) => {
      clearTimers()
      const { open: wasOpen, activeId: was } = latest.current
      const next = id ?? was
      if (wasOpen && next === was) return
      setChosenId(next)
      setOpen(true)
      if (!wasOpen) setOpenedBy(reason)
      latest.current = { ...latest.current, open: true, activeId: next }
      latest.current.onOpenChange?.(true, details(reason, next))
    }
    const close = (reason: PopoverOpenChangeReason) => {
      clearTimers()
      if (!latest.current.open) return
      setOpen(false)
      latest.current = { ...latest.current, open: false }
      latest.current.onOpenChange?.(false, details(reason, latest.current.activeId))
    }
    let lastHover: HoverOptions = {}
    const hoverOptions = (options: HoverOptions) => {
      lastHover = options
      return {
        openOnHover: options.openOnHover ?? latest.current.hover.openOnHover,
        delay: options.delay ?? latest.current.hover.delay,
        closeDelay: options.closeDelay ?? latest.current.hover.closeDelay,
      }
    }
    const scheduleClose = (wait: number) => {
      clearTimeout(closeTimer)
      closeTimer = setTimeout(() => {
        if (document.getElementById(store.snapshot.contentId ?? "")?.contains(document.activeElement)) return
        close("pointer-leave")
      }, wait)
    }

    const detach = store.attach({
      press: (id) => {
        const { open: isOpen, activeId: active, openedBy: by } = latest.current
        if (isOpen && active === id) {
          if (by === "trigger-hover") {
            clearTimers()
            setOpenedBy("trigger-press")
            latest.current = { ...latest.current, openedBy: "trigger-press" }
          } else close("trigger-press")
          return
        }
        openOn(id, "trigger-press")
      },
      hoverEnter: (id, event, options) => {
        if (event.pointerType === "touch") return
        const { openOnHover: enabled, delay: wait } = hoverOptions(options)
        if (!enabled) return
        clearTimeout(closeTimer)
        const { open: isOpen, activeId: active, openedBy: by } = latest.current
        if (isOpen) {
          if (active !== id && by === "trigger-hover") openOn(id, "trigger-hover")
          return
        }
        clearTimeout(openTimer)
        openTimer = setTimeout(() => openOn(id, "trigger-hover"), wait)
      },
      hoverLeave: (_id, event, options) => {
        if (event.pointerType === "touch") return
        clearTimeout(openTimer)
        const { closeDelay: wait } = hoverOptions(options)
        if (latest.current.open && latest.current.openedBy === "trigger-hover") scheduleClose(wait)
      },
      open: openOn,
      close,
    })
    contentHover.set(store, {
      enter: () => clearTimeout(closeTimer),
      leave: (event) => {
        if (event.pointerType === "touch") return
        if (latest.current.open && latest.current.openedBy === "trigger-hover") {
          scheduleClose(lastHover.closeDelay ?? latest.current.hover.closeDelay)
        }
      },
    })
    return () => {
      clearTimers()
      detach()
      contentHover.delete(store)
    }
  }, [store, setChosenId, setOpen])

  const context = React.useMemo<PopoverRootContextValue>(
    () => ({ store, open, activeId, payload, openedBy, contentId }),
    [store, open, activeId, payload, openedBy, contentId],
  )

  return (
    <StoreContext.Provider value={store}>
      <PopoverRootContext.Provider value={context}>
        <PopoverPrimitive.Root
          open={open}
          modal={modal}
          onOpenChange={(next) => (next ? store.root?.open(null, "imperative") : store.root?.close("dismiss"))}
        >
          {!hasCustomAnchor && <ActiveTriggerAnchor id={activeId} />}
          {children}
        </PopoverPrimitive.Root>
      </PopoverRootContext.Provider>
    </StoreContext.Provider>
  )
}

const contentHover = new WeakMap<
  PopoverStore,
  { enter: () => void; leave: (event: React.PointerEvent) => void }
>()

function ActiveTriggerAnchor({ id }: { id: string | null }) {
  const virtualRef = React.useMemo(
    () => ({
      get current() {
        return findTrigger(id) as HTMLElement
      },
    }),
    [id],
  )
  return <PopoverPrimitive.Anchor virtualRef={virtualRef as React.RefObject<HTMLElement>} />
}

export interface PopoverTriggerProps<Payload = unknown> extends React.ComponentProps<"button">, HoverOptions {
  asChild?: boolean
  handle?: PopoverHandle<Payload>
  payload?: Payload
}

export function PopoverTrigger<Payload = unknown>(props: PopoverTriggerProps<Payload>) {
  const contextStore = React.useContext(StoreContext)
  const store = props.handle?.store ?? contextStore
  if (!store) {
    return <PopoverPrimitive.Trigger {...withoutStoreProps(props)} />
  }
  return <StoreTrigger store={store} {...props} />
}

function withoutStoreProps<Payload>(props: PopoverTriggerProps<Payload>) {
  const rest: Partial<PopoverTriggerProps<Payload>> = { ...props }
  for (const key of ["handle", "payload", "openOnHover", "delay", "closeDelay"] as const) delete rest[key]
  return rest as React.ComponentProps<"button">
}

function StoreTrigger<Payload>({
  store,
  payload,
  openOnHover,
  delay,
  closeDelay,
  asChild,
  id: idProp,
  onClick,
  onPointerEnter,
  onPointerLeave,
  ...rest
}: PopoverTriggerProps<Payload> & { store: PopoverStore }) {
  const props = withoutStoreProps(rest)
  const reactId = React.useId()
  const id = idProp ?? reactId
  const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
  const active = snapshot.open && snapshot.activeId === id
  const hover = { openOnHover, delay, closeDelay }

  React.useLayoutEffect(() => {
    store.register(id, payload)
    return () => store.unregister(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, id])
  React.useLayoutEffect(() => store.setPayload(id, payload), [store, id, payload])

  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      type="button"
      data-popover-trigger={id}
      aria-haspopup="dialog"
      aria-expanded={active}
      aria-controls={active ? snapshot.contentId : undefined}
      data-state={active ? "open" : "closed"}
      id={idProp}
      {...props}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (!event.defaultPrevented) store.root?.press(id)
      }}
      onPointerEnter={(event: React.PointerEvent<HTMLButtonElement>) => {
        onPointerEnter?.(event)
        store.root?.hoverEnter(id, event, hover)
      }}
      onPointerLeave={(event: React.PointerEvent<HTMLButtonElement>) => {
        onPointerLeave?.(event)
        store.root?.hoverLeave(id, event, hover)
      }}
    />
  )
}

export function PopoverAnchor(props: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  const store = React.useContext(StoreContext)
  React.useLayoutEffect(() => store?.addCustomAnchor(), [store])
  return <PopoverPrimitive.Anchor {...props} />
}

export const PopoverClose = PopoverPrimitive.Close

export interface PopoverContentProps<Payload = unknown>
  extends Omit<React.ComponentProps<typeof PopoverPrimitive.Content>, "children">,
    VariantProps<typeof popoverVariants> {
  showArrow?: boolean
  children?: React.ReactNode | ((payload: Payload) => React.ReactNode)
}

export function PopoverContent<Payload = unknown>({
  className,
  align = "center",
  sideOffset = 8,
  collisionPadding = 8,
  density,
  showArrow = false,
  children,
  id,
  onOpenAutoFocus,
  onCloseAutoFocus,
  onInteractOutside,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  ...props
}: PopoverContentProps<Payload>) {
  const slots = popoverVariants({ density: useDensity(density) })
  const root = React.useContext(PopoverRootContext)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const interactedOutside = React.useRef(false)
  const focusedInside = React.useRef(false)
  useGlide(contentRef, root?.activeId ?? null)

  const body =
    typeof children === "function" ? (
      <PopoverViewport>{children as (payload: unknown) => React.ReactNode}</PopoverViewport>
    ) : (
      children
    )

  const managed: Partial<React.ComponentProps<typeof PopoverPrimitive.Content>> = root
    ? {
        id: id ?? root.contentId,
        onOpenAutoFocus: (event) => {
          onOpenAutoFocus?.(event)
          interactedOutside.current = false
          focusedInside.current = false
          if (root.openedBy === "trigger-hover") event.preventDefault()
        },
        onCloseAutoFocus: (event) => {
          onCloseAutoFocus?.(event)
          if (event.defaultPrevented) return
          event.preventDefault()
          const refocus =
            !interactedOutside.current && (root.openedBy !== "trigger-hover" || focusedInside.current)
          interactedOutside.current = false
          focusedInside.current = false
          if (refocus) findTrigger(root.activeId)?.focus()
        },
        onInteractOutside: (event) => {
          if (isTriggerOf(root.store, event.target)) {
            event.preventDefault()
            return
          }
          onInteractOutside?.(event)
          if (!event.defaultPrevented) interactedOutside.current = true
        },
        onFocus: (event) => {
          onFocus?.(event)
          focusedInside.current = true
        },
        onPointerEnter: (event) => {
          onPointerEnter?.(event)
          contentHover.get(root.store)?.enter()
        },
        onPointerLeave: (event) => {
          onPointerLeave?.(event)
          contentHover.get(root.store)?.leave(event)
        },
      }
    : { id, onOpenAutoFocus, onCloseAutoFocus, onInteractOutside, onFocus, onPointerEnter, onPointerLeave }

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={contentRef}
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={slots.content({
          className: [
            "max-w-(--radix-popover-content-available-width) origin-(--radix-popover-content-transform-origin)",
            !showArrow && "max-h-(--radix-popover-content-available-height) overflow-y-auto overscroll-contain",
            className,
          ],
        })}
        {...props}
        {...managed}
      >
        {body}
        {showArrow && <PopoverPrimitive.Arrow className={slots.arrow()} width={12} height={6} />}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}

function useGlide(contentRef: React.RefObject<HTMLDivElement | null>, activeId: string | null) {
  const previousId = React.useRef(activeId)
  React.useLayoutEffect(() => {
    const was = previousId.current
    previousId.current = activeId
    const wrapper = contentRef.current?.parentElement ?? null
    if (!wrapper || was === activeId) return
    if (wrapper.style.transform.includes("-200%")) return
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    wrapper.style.setProperty("transition", "transform var(--duration-base) var(--ease-out)")
    const done = (event: TransitionEvent) => {
      if (event.target !== wrapper || event.propertyName !== "transform") return
      wrapper.style.removeProperty("transition")
      wrapper.removeEventListener("transitionend", done)
    }
    wrapper.addEventListener("transitionend", done)
  })
}

type ActivationDirection = "left" | "right" | "up" | "down"

const ENTER: Record<ActivationDirection, string> = { right: "from-right", left: "from-left", down: "from-bottom", up: "from-top" }
const EXIT: Record<ActivationDirection, string> = { right: "to-left", left: "to-right", down: "to-top", up: "to-bottom" }

function activationDirection(from: string | null, to: string | null): ActivationDirection | null {
  const a = findTrigger(from)?.getBoundingClientRect()
  const b = findTrigger(to)?.getBoundingClientRect()
  if (!a || !b) return null
  const dx = b.left + b.width / 2 - (a.left + a.width / 2)
  const dy = b.top + b.height / 2 - (a.top + a.height / 2)
  if (dx === 0 && dy === 0) return null
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up"
}

interface ViewState {
  id: string | null
  payload: unknown
  previous: { id: string | null; payload: unknown } | null
  direction: ActivationDirection | null
  switched: boolean
}

export interface PopoverViewportProps extends Omit<React.ComponentProps<"div">, "children"> {
  children?: React.ReactNode | ((payload: never) => React.ReactNode)
}

export function PopoverViewport({ className, children, style, ...props }: PopoverViewportProps) {
  const slots = popoverVariants()
  const root = React.useContext(PopoverRootContext)
  const activeId = root?.activeId ?? null
  const payload = root?.payload
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const currentRef = React.useRef<HTMLDivElement>(null)

  const [view, setView] = React.useState<ViewState>({ id: activeId, payload, previous: null, direction: null, switched: false })
  if (view.id !== activeId) {
    setView({ id: activeId, payload, previous: { id: view.id, payload: view.payload }, direction: null, switched: true })
  } else if (!Object.is(view.payload, payload)) {
    setView({ ...view, payload })
  }

  React.useLayoutEffect(() => {
    if (!view.previous || view.direction) return
    const direction = activationDirection(view.previous.id, view.id)
    const apply = () =>
      setView((current) =>
        current.id !== view.id ? current : direction ? { ...current, direction } : { ...current, previous: null },
      )
    apply()
  }, [view.previous, view.direction, view.id])

  React.useLayoutEffect(() => {
    const viewport = viewportRef.current
    const current = currentRef.current
    if (!viewport || !current) return
    const measure = () => {
      viewport.style.width = `${current.offsetWidth}px`
      viewport.style.height = `${current.offsetHeight}px`
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(current)
    return () => observer.disconnect()
  }, [view.id])

  const render = (value: unknown) =>
    typeof children === "function" ? (value === undefined ? null : (children as (p: unknown) => React.ReactNode)(value)) : children

  const clearPrevious = (event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    setView((current) => ({ ...current, previous: null }))
  }

  return (
    <div
      ref={viewportRef}
      data-slot="popover-viewport"
      data-instant={view.switched ? undefined : ""}
      data-activation-direction={view.direction ?? undefined}
      className={slots.viewport({ className })}
      style={style}
      {...props}
    >
      {view.previous && view.direction && (
        <div
          key={`previous-${view.previous.id}`}
          data-slot="popover-viewport-item"
          data-previous=""
          data-motion={EXIT[view.direction]}
          aria-hidden
          inert
          onAnimationEnd={clearPrevious}
          className={slots.viewportItem()}
        >
          {render(view.previous.payload)}
        </div>
      )}
      <div
        key={`current-${view.id}`}
        ref={currentRef}
        data-slot="popover-viewport-item"
        data-current=""
        data-motion={view.direction ? ENTER[view.direction] : undefined}
        className={slots.viewportItem()}
      >
        {render(payload)}
      </div>
    </div>
  )
}

export function PopoverTitle({ className, ...props }: React.ComponentProps<"h4">) {
  const { title } = popoverVariants()
  return <h4 data-slot="popover-title" className={title({ className })} {...props} />
}

export function PopoverDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { description } = popoverVariants()
  return <p data-slot="popover-description" className={description({ className })} {...props} />
}

export function PopoverMedia({ className, ...props }: React.ComponentProps<"div">) {
  const { media } = popoverVariants()
  return <div data-slot="popover-media" className={media({ className })} {...props} />
}

export function PopoverFooter({ className, ...props }: React.ComponentProps<"div">) {
  const { footer } = popoverVariants()
  return <div data-slot="popover-footer" className={footer({ className })} {...props} />
}

export function PopoverCloseButton({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Close>) {
  const { close } = popoverVariants()
  return (
    <PopoverPrimitive.Close data-slot="popover-close" className={close({ className })} {...props}>
      {children}
    </PopoverPrimitive.Close>
  )
}
