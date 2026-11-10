"use client"

import * as React from "react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"
import { ArrowLeft, CaretRight, Check } from "koala-icons"

import { tv, type VariantProps } from "@/lib/tv"
import { cn } from "@/lib/utils"
import { DensityProvider, useDensity } from "@/lib/density"
import { duration, easing, prefersReducedMotion } from "@/lib/motion"
import { Kbd } from "@/components/ui/kbd"
import { SwitchIndicator } from "@/components/ui/switch"
import { Tooltip, type TooltipProps } from "@/components/ui/tooltip"

export const dropdownMenuVariants = tv({
  slots: {
    content: [
      "z-50 min-w-[8rem] overflow-x-hidden overflow-y-auto overscroll-contain rounded-lg bg-popover ring-1 ring-inset ring-border [--surface:var(--popover)]",
      "max-w-(--radix-dropdown-menu-content-available-width) max-h-(--radix-dropdown-menu-content-available-height)",
      "text-popover-foreground shadow-lg",
      "transition-[opacity,translate] duration-base ease-out motion-reduce:transition-none",
      "starting:opacity-0",
      "data-[side=bottom]:starting:-translate-y-2 data-[side=top]:starting:translate-y-2",
      "data-[side=left]:starting:translate-x-2 data-[side=right]:starting:-translate-x-2",
      "data-[state=closed]:pointer-events-none data-[state=closed]:animate-presence-hold data-[state=closed]:opacity-0",
      "data-[side=bottom]:data-[state=closed]:-translate-y-2 data-[side=top]:data-[state=closed]:translate-y-2",
      "data-[side=left]:data-[state=closed]:translate-x-2 data-[side=right]:data-[state=closed]:-translate-x-2",
    ],
    item: [
      "relative flex cursor-pointer select-none items-center gap-2 text-sm font-normal outline-none",
      "transition-colors duration-fast ease-out",
      "focus:bg-accent focus:text-accent-foreground",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      "[&>svg]:text-muted-foreground [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
      "has-[[data-slot=dropdown-menu-item-description]]:items-start has-[[data-slot=dropdown-menu-item-description]]:py-2.5 has-[[data-slot=dropdown-menu-item-description]]:font-medium dark:has-[[data-slot=dropdown-menu-item-description]]:font-normal",
    ],
    itemText: "flex min-w-0 flex-col gap-0.5",
    itemDescription: "text-sm font-normal text-pretty text-muted-foreground",
    checkboxItem: [
      "relative flex cursor-pointer select-none items-center gap-2 text-sm font-normal outline-none",
      "transition-colors duration-fast ease-out",
      "focus:bg-accent focus:text-accent-foreground",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      "[&>svg]:text-muted-foreground [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
    ],
    radioItem: [
      "relative flex cursor-pointer select-none items-center gap-2 text-sm font-normal outline-none",
      "transition-colors duration-fast ease-out",
      "focus:bg-accent focus:text-accent-foreground",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      "[&>svg]:text-muted-foreground [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
    ],
    subTrigger: [
      "group flex cursor-pointer select-none items-center gap-2 text-sm font-normal outline-none",
      "transition-colors duration-fast ease-out",
      "focus:bg-accent focus:text-accent-foreground",
      "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
      "[&>svg]:text-muted-foreground [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
    ],
    subContent: [
      "z-50 min-w-[8rem] overflow-hidden rounded-lg bg-popover ring-1 ring-inset ring-border [--surface:var(--popover)]",
      "text-popover-foreground shadow-lg",
      "transition-[opacity,translate] duration-base ease-out motion-reduce:transition-none",
      "starting:opacity-0",
      "data-[side=bottom]:starting:-translate-y-2 data-[side=top]:starting:translate-y-2",
      "data-[side=left]:starting:translate-x-2 data-[side=right]:starting:-translate-x-2",
      "data-[state=closed]:pointer-events-none data-[state=closed]:animate-presence-hold data-[state=closed]:opacity-0",
    ],
    itemIndicator: "absolute right-2 flex size-4 items-center justify-center text-foreground",
    label: "font-medium text-muted-foreground",
    separator: "-mx-0.75 h-px bg-border",
    subCaret: "ml-auto size-4 text-muted-foreground",
    navigationViewport: [
      "-mx-1 overflow-hidden px-1",
      "data-[ready]:transition-[height] data-[ready]:duration-base data-[ready]:ease-out",
      "motion-reduce:transition-none",
    ],
  },
  variants: {
    density: {
      comfortable: {
        content: "p-1",
        item: "px-2 min-h-control-md py-1.5 rounded-md",
        checkboxItem: "px-2 pr-8 min-h-control-md py-1.5 rounded-md",
        radioItem: "px-2 pr-8 min-h-control-md py-1.5 rounded-md",
        subTrigger: "px-2 min-h-control-md py-1.5 rounded-md",
        subContent: "p-1",
        label: "px-2 py-1.5 text-xs",
        separator: "my-1.5",
      },
      compact: {
        content: "p-1",
        item: "px-2 min-h-control-sm py-1 rounded-md",
        checkboxItem: "px-2 pr-8 min-h-control-sm py-1 rounded-md",
        radioItem: "px-2 pr-8 min-h-control-sm py-1 rounded-md",
        subTrigger: "px-2 min-h-control-sm py-1 rounded-md",
        subContent: "p-1",
        label: "px-2 py-1 text-xs",
        separator: "my-1",
      },
    },
    variant: {
      default: {},
      destructive: {
        item: "text-destructive focus:bg-destructive/10 focus:text-destructive [&>svg]:text-destructive",
      },
    },
    indicator: {
      check: {},
      switch: { checkboxItem: "pr-2" },
    },
  },
  defaultVariants: { density: "comfortable", variant: "default", indicator: "check" },
})

type DropdownMenuDensityProps = Pick<VariantProps<typeof dropdownMenuVariants>, "density">

function withDensity(density: DropdownMenuDensityProps["density"], children: React.ReactNode) {
  return density ? <DensityProvider density={density}>{children}</DensityProvider> : children
}

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
export const DropdownMenuGroup = DropdownMenuPrimitive.Group
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal

interface MenuNavigation {
  path: string[]
  openLayer: (depth: number, id: string) => void
  back: () => void
}

const MenuNavigationContext = React.createContext<MenuNavigation | null>(null)
const MenuLayerContext = React.createContext(0)
const MenuSubContext = React.createContext<{ id: string; depth: number } | null>(null)

function useOffLayer() {
  const navigation = React.useContext(MenuNavigationContext)
  const depth = React.useContext(MenuLayerContext)
  return navigation !== null && navigation.path.length !== depth
}

function isRtl(element: Element) {
  return getComputedStyle(element).direction === "rtl"
}

export interface DropdownMenuContentProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.Content>,
    DropdownMenuDensityProps {
  container?: HTMLElement | null
  submenu?: "nested" | "navigation"
}

const PHONE_QUERY = "(max-width: 30rem)"
const subscribePhone = (onChange: () => void) => {
  const query = window.matchMedia?.(PHONE_QUERY)
  query?.addEventListener("change", onChange)
  return () => query?.removeEventListener("change", onChange)
}
const isPhone = () => window.matchMedia?.(PHONE_QUERY).matches ?? false
const notPhone = () => false

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  collisionPadding = 8,
  density,
  container,
  submenu: submenuProp,
  children,
  onKeyDown,
  onPointerDown,
  onEscapeKeyDown,
  onCloseAutoFocus,
  onPointerDownOutside,
  ref,
  ...props
}: DropdownMenuContentProps) {
  const slots = dropdownMenuVariants({ density: useDensity(density) })
  const phone = React.useSyncExternalStore(subscribePhone, isPhone, notPhone)
  const submenu = submenuProp ?? (phone ? "navigation" : "nested")
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const setContentRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )
  const fullscreen = typeof document === "undefined" ? null : (document.fullscreenElement as HTMLElement | null)

  const [path, setPath] = React.useState<string[]>([])
  const input = React.useRef<"keyboard" | "pointer">("pointer")
  const openLayer = React.useCallback((depth: number, id: string) => {
    setPath((current) => [...current.slice(0, depth), id])
  }, [])
  const back = React.useCallback(() => setPath((current) => current.slice(0, -1)), [])
  const navigation = React.useMemo(
    () => (submenu === "navigation" ? { path, openLayer, back } : null),
    [submenu, path, openLayer, back],
  )

  return (
    <DropdownMenuPrimitive.Portal container={container ?? fullscreen ?? undefined}>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        data-submenu={submenu}
        ref={setContentRef}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={slots.content({ className })}
        onPointerDownOutside={(event) => {
          onPointerDownOutside?.(event)
          const labelledBy = contentRef.current?.getAttribute("aria-labelledby")
          const trigger = labelledBy ? document.getElementById(labelledBy) : null
          const target = event.detail.originalEvent.target
          if (trigger && target instanceof Node && trigger.contains(target)) event.preventDefault()
        }}
        onPointerDown={(event) => {
          input.current = "pointer"
          onPointerDown?.(event)
        }}
        onKeyDown={(event) => {
          input.current = "keyboard"
          onKeyDown?.(event)
          if (event.defaultPrevented || !navigation || navigation.path.length === 0) return
          if (event.key === (isRtl(event.currentTarget) ? "ArrowRight" : "ArrowLeft")) {
            event.preventDefault()
            back()
          }
        }}
        onEscapeKeyDown={(event) => {
          onEscapeKeyDown?.(event)
          if (event.defaultPrevented || !navigation || navigation.path.length === 0) return
          event.preventDefault()
          input.current = "keyboard"
          back()
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event)
          setPath([])
        }}
        {...props}
      >
        {navigation ? (
          <MenuNavigationContext.Provider value={navigation}>
            <MenuNavigationViewport className={slots.navigationViewport()} path={path} input={input}>
              {withDensity(density, children)}
            </MenuNavigationViewport>
          </MenuNavigationContext.Provider>
        ) : (
          withDensity(density, children)
        )}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  )
}

function MenuNavigationViewport({
  className,
  path,
  input,
  children,
}: {
  className: string
  path: string[]
  input: React.RefObject<"keyboard" | "pointer">
  children: React.ReactNode
}) {
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const [height, setHeight] = React.useState<number | null>(null)

  React.useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const measure = () => setHeight(viewport.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  const layer = path.join("/")
  const shown = React.useRef({ layer, path })
  React.useEffect(() => {
    const previous = shown.current
    if (previous.layer === layer) return
    shown.current = { layer, path }
    const viewport = viewportRef.current
    if (!viewport) return

    const forward = path.length > previous.path.length
    if (typeof viewport.animate === "function" && !prefersReducedMotion()) {
      const offset = (forward ? 8 : -8) * (isRtl(viewport) ? -1 : 1)
      viewport.animate(
        [
          { opacity: 0, transform: `translateX(${offset}px)` },
          { opacity: 1, transform: "none" },
        ],
        { duration: duration.base, easing: easing.out },
      )
    }

    if (input.current === "keyboard") {
      const left = forward ? null : previous.path[previous.path.length - 1]
      const target =
        (left && viewport.querySelector<HTMLElement>(`[data-menu-sub="${CSS.escape(left)}"]`)) ||
        viewport.querySelector<HTMLElement>('[role^="menuitem"]:not([data-disabled])')
      target?.focus({ preventScroll: true })
    } else {
      const content = viewport.closest<HTMLElement>('[data-slot="dropdown-menu-content"]')
      if (content && !content.contains(document.activeElement)) content.focus({ preventScroll: true })
    }
  }, [layer, path, input])

  return (
    <div
      data-slot="dropdown-menu-navigation"
      data-ready={height === null ? undefined : ""}
      style={height === null ? undefined : { height }}
      className={className}
    >
      <div ref={viewportRef}>{children}</div>
    </div>
  )
}

export type DropdownMenuSubProps = React.ComponentProps<typeof DropdownMenuPrimitive.Sub>

export function DropdownMenuSub(props: DropdownMenuSubProps) {
  const navigation = React.useContext(MenuNavigationContext)
  const depth = React.useContext(MenuLayerContext)
  const id = React.useId()
  const sub = React.useMemo(() => ({ id, depth }), [id, depth])
  if (!navigation) return <DropdownMenuPrimitive.Sub {...props} />
  return <MenuSubContext.Provider value={sub}>{props.children}</MenuSubContext.Provider>
}

export interface DropdownMenuItemHintProps {
  /** A hint beside the row on hover and keyboard focus, for terse labels that need their trade-off. */
  tooltip?: React.ReactNode
  tooltipPlacement?: TooltipProps["placement"]
}

function withHint(item: React.ReactElement, tooltip: React.ReactNode, placement: TooltipProps["placement"] = "right") {
  if (!tooltip) return item
  return (
    <Tooltip auto content={tooltip} placement={placement} offset={[0, 8]}>
      {item}
    </Tooltip>
  )
}

export interface DropdownMenuItemProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.Item>,
    Omit<VariantProps<typeof dropdownMenuVariants>, "indicator">,
    DropdownMenuItemHintProps {
  inset?: boolean
}

export function DropdownMenuItem({
  className,
  inset,
  density,
  variant,
  tooltip,
  tooltipPlacement,
  ...props
}: DropdownMenuItemProps) {
  const slots = dropdownMenuVariants({ density: useDensity(density), variant })
  if (useOffLayer()) return null
  return withHint(
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset || undefined}
      className={slots.item({ className: cn(inset && "pl-9", className) })}
      {...props}
    />,
    tooltip,
    tooltipPlacement,
  )
}

export function DropdownMenuItemText({ className, ...props }: React.ComponentProps<"span">) {
  const slots = dropdownMenuVariants()
  return <span data-slot="dropdown-menu-item-text" className={slots.itemText({ className })} {...props} />
}

export function DropdownMenuItemDescription({ className, ...props }: React.ComponentProps<"span">) {
  const slots = dropdownMenuVariants()
  return (
    <span
      data-slot="dropdown-menu-item-description"
      className={slots.itemDescription({ className })}
      {...props}
    />
  )
}

export interface DropdownMenuCheckboxItemProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>,
    Omit<VariantProps<typeof dropdownMenuVariants>, "variant" | "indicator">,
    DropdownMenuItemHintProps {
  variant?: "check" | "switch"
  closeOnSelect?: boolean
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  density,
  variant = "check",
  closeOnSelect = variant !== "switch",
  onSelect,
  tooltip,
  tooltipPlacement,
  ...props
}: DropdownMenuCheckboxItemProps) {
  const slots = dropdownMenuVariants({ density: useDensity(density), indicator: variant })
  if (useOffLayer()) return null
  return withHint(
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={slots.checkboxItem({ className })}
      checked={checked}
      onSelect={(event) => {
        onSelect?.(event)
        if (!closeOnSelect) event.preventDefault()
      }}
      {...props}
    >
      {variant === "switch" ? (
        <>
          {children}
          <SwitchIndicator checked={checked === true} className="ml-auto" />
        </>
      ) : (
        <>
          <span className={slots.itemIndicator()}>
            <DropdownMenuPrimitive.ItemIndicator>
              <Check weight="bold" className="size-4" />
            </DropdownMenuPrimitive.ItemIndicator>
          </span>
          {children}
        </>
      )}
    </DropdownMenuPrimitive.CheckboxItem>,
    tooltip,
    tooltipPlacement,
  )
}

export interface DropdownMenuRadioItemProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>,
    DropdownMenuDensityProps,
    DropdownMenuItemHintProps {}

export function DropdownMenuRadioItem({
  className,
  children,
  density,
  tooltip,
  tooltipPlacement,
  ...props
}: DropdownMenuRadioItemProps) {
  const slots = dropdownMenuVariants({ density: useDensity(density) })
  if (useOffLayer()) return null
  return withHint(
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={slots.radioItem({ className })}
      {...props}
    >
      <span className={slots.itemIndicator()}>
        <DropdownMenuPrimitive.ItemIndicator>
          <Check weight="bold" className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>,
    tooltip,
    tooltipPlacement,
  )
}

export interface DropdownMenuLabelProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.Label>,
    DropdownMenuDensityProps {
  inset?: boolean
}

export function DropdownMenuLabel({
  className,
  inset,
  density,
  ...props
}: DropdownMenuLabelProps) {
  const slots = dropdownMenuVariants({ density: useDensity(density) })
  if (useOffLayer()) return null
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={slots.label({ className: cn(inset && "pl-9", className) })}
      {...props}
    />
  )
}

export function DropdownMenuSeparator({
  className,
  density,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator> & DropdownMenuDensityProps) {
  const slots = dropdownMenuVariants({ density: useDensity(density) })
  if (useOffLayer()) return null
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={slots.separator({ className })}
      {...props}
    />
  )
}

export function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<typeof Kbd>) {
  return (
    <Kbd
      data-slot="dropdown-menu-shortcut"
      size="sm"
      className={cn("ml-auto", className)}
      {...props}
    />
  )
}

export interface DropdownMenuSubTriggerProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger>,
    DropdownMenuDensityProps {
  inset?: boolean
}

export function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  density,
  ...props
}: DropdownMenuSubTriggerProps) {
  const slots = dropdownMenuVariants({ density: useDensity(density) })
  const navigation = React.useContext(MenuNavigationContext)
  const sub = React.useContext(MenuSubContext)
  const offLayer = useOffLayer()

  if (navigation && sub) {
    if (offLayer) return null
    const { onKeyDown, ...rest } = props
    const open = () => navigation.openLayer(sub.depth, sub.id)
    return (
      <DropdownMenuPrimitive.Item
        data-slot="dropdown-menu-sub-trigger"
        data-menu-sub={sub.id}
        className={slots.subTrigger({ className: cn(inset && "pl-9", className) })}
        {...rest}
        onSelect={(event) => {
          event.preventDefault()
          open()
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.defaultPrevented) return
          if (event.key === (isRtl(event.currentTarget) ? "ArrowLeft" : "ArrowRight")) {
            event.preventDefault()
            open()
          }
        }}
      >
        {children}
        <CaretRight weight="bold" className={slots.subCaret()} />
      </DropdownMenuPrimitive.Item>
    )
  }

  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      className={slots.subTrigger({ className: cn(inset && "pl-9", className) })}
      {...props}
    >
      {children}
      <CaretRight weight="bold" className={slots.subCaret()} />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

export interface DropdownMenuSubContentProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>,
    DropdownMenuDensityProps {
  backLabel?: string
}

export function DropdownMenuSubContent({
  className,
  density,
  backLabel = "Back",
  children,
  ...props
}: DropdownMenuSubContentProps) {
  const slots = dropdownMenuVariants({ density: useDensity(density) })
  const navigation = React.useContext(MenuNavigationContext)
  const sub = React.useContext(MenuSubContext)

  if (navigation && sub) {
    if (navigation.path[sub.depth] !== sub.id) return null
    const current = navigation.path.length === sub.depth + 1
    return (
      <MenuLayerContext.Provider value={sub.depth + 1}>
        {current && (
          <DropdownMenuPrimitive.Item
            data-slot="dropdown-menu-back"
            className={slots.item()}
            onSelect={(event) => {
              event.preventDefault()
              navigation.back()
            }}
          >
            <ArrowLeft weight="bold" />
            {backLabel}
          </DropdownMenuPrimitive.Item>
        )}
        {withDensity(density, children)}
      </MenuLayerContext.Provider>
    )
  }

  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      collisionPadding={8}
      className={slots.subContent({ className })}
      {...props}
    >
      {withDensity(density, children)}
    </DropdownMenuPrimitive.SubContent>
  )
}
