"use client"

import * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"

import { createContext } from "@/lib/create-context"
import { cn } from "@/lib/utils"
import { useButtonSize } from "@/lib/density"
import { tv, type VariantProps } from "@/lib/tv"
import { hitY } from "@/lib/hit-area"
import { toggleItemBase } from "@/components/ui/toggle"
import { Tooltip, TooltipGroup, type TooltipProps } from "@/components/ui/tooltip/tooltip"

declare const process: { env: { NODE_ENV?: string } }

const hitX = hitY

export const toggleGroupVariants = tv({
  slots: {
    root: "group/toggle-group inline-flex items-center gap-2",
    thumb: "pointer-events-none absolute left-0 top-0 z-0",
    thumbSurface: [
      "block size-full rounded-[inherit] bg-background shadow-sm ring-1 ring-border dark:bg-foreground/10",
      "transition-[scale] duration-fast ease-out motion-reduce:transition-none",
    ],
    item: [
      ...toggleItemBase,
      "transition duration-fast ease-out",
    ],
    mark: "size-2.5 shrink-0 rounded-full bg-(--toggle-group-mark)",
  },
  variants: {
    variant: {
      outline: {},
      segmented: {
        root: "relative gap-0.5 bg-muted dark:bg-foreground/6",
        item: [
          "z-10 border-transparent bg-transparent",
          "data-[state=off]:hover:bg-transparent data-[state=off]:hover:text-foreground",
          "data-[state=on]:border-transparent data-[state=on]:text-foreground",
          "data-[state=on]:ring-0 data-[state=on]:ring-border",
          "group-data-[thumb=off]/toggle-group:data-[state=on]:bg-background",
          "dark:group-data-[thumb=off]/toggle-group:data-[state=on]:bg-foreground/10",
          "group-data-[thumb=off]/toggle-group:data-[state=on]:shadow-sm",
          "group-data-[thumb=off]/toggle-group:data-[state=on]:ring-1",
        ],
      },
      ghost: {
        item: [
          "border-transparent bg-transparent text-foreground",
          "underline decoration-transparent decoration-[1.5px] underline-offset-[6px]",
          "data-[state=on]:border-transparent data-[state=on]:font-medium data-[state=on]:ring-0 data-[state=on]:decoration-foreground",
        ],
      },
    },
    size: {
      sm: { root: "[--button-corner:var(--radius-md)]", item: `h-control-sm px-3 text-sm has-[>svg]:px-2.5 ${hitX}` },
      md: { root: "[--button-corner:calc(var(--radius)*0.875)]", item: `h-control-md px-4 text-sm has-[>svg]:px-3 ${hitX}` },
      lg: { root: "[--button-corner:var(--radius-lg)]", item: `h-control-lg px-5 text-sm has-[>svg]:px-4 ${hitX}` },
      xl: { root: "[--button-corner:calc(var(--radius)*1.125)]", item: "h-control-xl px-6 text-base has-[>svg]:px-5 [&_svg:not([class*='size-'])]:size-5" },
    },
    iconOnly: {
      true: {},
      false: {},
    },
  },
  compoundVariants: [
    { size: "sm", iconOnly: true, className: { item: "w-control-sm px-0 has-[>svg]:px-0" } },
    { size: "md", iconOnly: true, className: { item: "w-control-md px-0 has-[>svg]:px-0" } },
    { size: "lg", iconOnly: true, className: { item: "w-control-lg px-0 has-[>svg]:px-0" } },
    { size: "xl", iconOnly: true, className: { item: "w-control-xl px-0 has-[>svg]:px-0" } },
    {
      variant: "segmented",
      className: {
        root: "h-fit rounded-[calc(var(--button-radius,var(--button-corner))+0.125rem)] p-0.5",
        thumb: "rounded-[var(--button-radius,var(--button-corner))]",
      },
    },
    { variant: "segmented", size: "sm", className: { item: "h-[calc(var(--spacing-control-sm)-0.25rem)] px-2.5 has-[>svg]:px-2" } },
    { variant: "segmented", size: "md", className: { item: "h-[calc(var(--spacing-control-md)-0.25rem)] px-3 has-[>svg]:px-2.5" } },
    { variant: "segmented", size: "lg", className: { item: "h-[calc(var(--spacing-control-lg)-0.25rem)] px-4 has-[>svg]:px-3" } },
    { variant: "segmented", size: "xl", className: { item: "h-[calc(var(--spacing-control-xl)-0.25rem)] px-5 has-[>svg]:px-4" } },
    { variant: "segmented", size: "sm", iconOnly: true, className: { item: "w-[calc(var(--spacing-control-sm)-0.25rem)] px-0 has-[>svg]:px-0" } },
    { variant: "segmented", size: "md", iconOnly: true, className: { item: "w-[calc(var(--spacing-control-md)-0.25rem)] px-0 has-[>svg]:px-0" } },
    { variant: "segmented", size: "lg", iconOnly: true, className: { item: "w-[calc(var(--spacing-control-lg)-0.25rem)] px-0 has-[>svg]:px-0" } },
    { variant: "segmented", size: "xl", iconOnly: true, className: { item: "w-[calc(var(--spacing-control-xl)-0.25rem)] px-0 has-[>svg]:px-0" } },
  ],
  defaultVariants: {
    variant: "outline",
    size: "md",
  },
})

type ToggleGroupSlots = ReturnType<typeof toggleGroupVariants>
const [ToggleGroupProvider, useToggleGroupContext] =
  createContext<{ slots: ToggleGroupSlots }>("ToggleGroup")

function useSelectedThumb(rootRef: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [style, setStyle] = React.useState<React.CSSProperties>()
  const [ready, setReady] = React.useState(false)
  const [animate, setAnimate] = React.useState(false)

  React.useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || !enabled) return

    const measure = () => {
      const on = root.querySelectorAll<HTMLElement>('[data-state="on"]')
      if (on.length !== 1) {
        setReady(false)
        return
      }
      const { offsetLeft: left, offsetTop: top, offsetWidth: width, offsetHeight: height } = on[0]
      setStyle({ transform: `translate(${left}px, ${top}px)`, width, height })
      setReady(true)
    }

    measure()

    const raf = requestAnimationFrame(() => setAnimate(true))

    const ro = new ResizeObserver(measure)
    ro.observe(root)
    for (const child of root.children) ro.observe(child)

    const mo = new MutationObserver(measure)
    mo.observe(root, { attributes: true, attributeFilter: ["data-state"], subtree: true })

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      mo.disconnect()
    }
  }, [rootRef, enabled])

  return { style, ready, animate }
}

export type ToggleGroupProps = React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  Omit<VariantProps<typeof toggleGroupVariants>, "iconOnly">

export function ToggleGroup({ className, size, variant, children, ref, ...props }: ToggleGroupProps) {
  const resolved = useButtonSize(size)
  const slots = toggleGroupVariants({ size: resolved === "xs" ? "sm" : resolved, variant })
  const segmented = variant === "segmented"
  const rootRef = React.useRef<HTMLDivElement>(null)
  const { style, ready, animate } = useSelectedThumb(rootRef, segmented)

  return (
    <ToggleGroupProvider slots={slots}>
      <ToggleGroupPrimitive.Root
        ref={(node) => {
          rootRef.current = node
          if (typeof ref === "function") return ref(node)
          if (ref) ref.current = node
        }}
        data-slot="toggle-group"
        data-thumb={segmented ? (ready ? "on" : "off") : undefined}
        className={slots.root({ className })}
        {...props}
      >
        {segmented && (
          <span
            aria-hidden
            data-slot="toggle-group-indicator"
            className={cn(
              slots.thumb(),
              ready ? "opacity-100" : "opacity-0",
              animate &&
                "transition-[transform,width,height,opacity] duration-base ease-out motion-reduce:transition-none",
            )}
            style={style}
          >
            <span className={slots.thumbSurface()} />
          </span>
        )}
        <TooltipGroup>{children}</TooltipGroup>
      </ToggleGroupPrimitive.Root>
    </ToggleGroupProvider>
  )
}

export interface ToggleGroupItemProps extends Omit<React.ComponentProps<typeof ToggleGroupPrimitive.Item>, "color"> {
  color?: string
  iconOnly?: boolean
  tooltip?: React.ReactNode | false
  tooltipPlacement?: TooltipProps["placement"]
}

export function ToggleGroupItem({
  className,
  children,
  color,
  iconOnly = false,
  tooltip,
  tooltipPlacement,
  ...props
}: ToggleGroupItemProps) {
  const { slots } = useToggleGroupContext("ToggleGroupItem")

  const ariaLabel = props["aria-label"]
  const ariaLabelledby = props["aria-labelledby"]
  const name =
    ariaLabel ?? (iconOnly && !ariaLabelledby && typeof tooltip === "string" ? tooltip : undefined)

  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production" && iconOnly && !name && !ariaLabelledby) {
      console.warn(
        "ToggleGroupItem: an `iconOnly` item has no accessible name. Pass `aria-label` (or a " +
          "string `tooltip`) so assistive tech can announce it.",
      )
    }
  }, [iconOnly, name, ariaLabelledby])

  const item = (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={slots.item({ iconOnly, className })}
      {...props}
      aria-label={name}
    >
      {color ? (
        <span
          aria-hidden="true"
          data-slot="toggle-group-item-mark"
          className={slots.mark()}
          style={{ "--toggle-group-mark": color } as React.CSSProperties}
        />
      ) : null}
      {children}
    </ToggleGroupPrimitive.Item>
  )

  const tooltipContent = tooltip === false ? null : (tooltip ?? (iconOnly ? ariaLabel : undefined))
  if (tooltipContent) {
    return (
      <Tooltip auto content={tooltipContent} placement={tooltipPlacement ?? "top"}>
        {item}
      </Tooltip>
    )
  }
  return item
}
