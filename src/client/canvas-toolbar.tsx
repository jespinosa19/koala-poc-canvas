import * as React from "react"
import { Toolbar as Bar } from "radix-ui"

import { Kbd } from "@/components/ui/kbd"
import { Tooltip, TooltipGroup } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/*
 * The canvas's floating bars (tools, ink, frame, selection). Built on the Radix toolbar primitive
 * (roving focus, arrow keys) with Koala UI Free pieces for the tooltip and the key hint. Only what
 * the canvas uses: one floating look, one size, horizontal.
 */

const control = cn(
  "relative inline-flex size-7 shrink-0 cursor-pointer select-none items-center justify-center rounded-sm",
  "text-muted-foreground outline-none transition-[background-color,color] duration-fast ease-out motion-reduce:transition-none",
  "hover:bg-accent hover:text-foreground",
  "data-[pressed]:bg-accent data-[pressed]:text-foreground data-[state=on]:bg-accent data-[state=on]:text-foreground",
  "data-[state=open]:bg-accent data-[state=open]:text-foreground",
  "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-background",
  "disabled:pointer-events-none disabled:opacity-40 data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  // A 28px control still gets a 40px-tall hit area.
  "after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']",
)

type Hint = { tooltip?: React.ReactNode; shortcut?: string }

function withHint(node: React.ReactElement, { tooltip, shortcut }: Hint) {
  if (!tooltip) return node
  const content = shortcut ? (
    <span className="flex items-center gap-1.5">
      {tooltip}
      <Kbd size="sm">{shortcut}</Kbd>
    </span>
  ) : (
    tooltip
  )
  return (
    <Tooltip auto content={content} placement="top">
      {node}
    </Tooltip>
  )
}

const labelOf = (ariaLabel: string | undefined, tooltip: React.ReactNode) =>
  ariaLabel ?? (typeof tooltip === "string" ? tooltip : undefined)

export function Toolbar({ className, children, ...props }: React.ComponentProps<typeof Bar.Root>) {
  return (
    <Bar.Root
      data-slot="canvas-toolbar"
      aria-label={props["aria-label"] ?? "Toolbar"}
      className={cn(
        "relative isolate inline-flex flex-row items-center rounded-md bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-border ring-inset [--surface:var(--popover)]",
        "max-sm:max-w-full max-sm:overflow-x-auto max-sm:overflow-y-hidden max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden",
        className,
      )}
      {...props}
    >
      <TooltipGroup>{children}</TooltipGroup>
    </Bar.Root>
  )
}

export function ToolbarButton({
  className,
  pressed,
  tooltip,
  shortcut,
  "aria-label": ariaLabel,
  ...props
}: Omit<React.ComponentProps<typeof Bar.Button>, "aria-pressed"> & Hint & { pressed?: boolean }) {
  return withHint(
    <Bar.Button
      type="button"
      data-pressed={pressed || undefined}
      aria-pressed={pressed}
      aria-label={labelOf(ariaLabel, tooltip)}
      className={cn(control, className)}
      {...props}
    />,
    { tooltip, shortcut },
  )
}

export function ToolbarToggleGroup({ className, ...props }: React.ComponentProps<typeof Bar.ToggleGroup>) {
  return <Bar.ToggleGroup className={cn("flex items-center", className)} {...props} />
}

export function ToolbarToggleItem({
  className,
  tooltip,
  shortcut,
  "aria-label": ariaLabel,
  ...props
}: React.ComponentProps<typeof Bar.ToggleItem> & Hint) {
  return withHint(
    <Bar.ToggleItem aria-label={labelOf(ariaLabel, tooltip)} className={cn(control, className)} {...props} />,
    { tooltip, shortcut },
  )
}

export function ToolbarSeparator({ className, ...props }: React.ComponentProps<typeof Bar.Separator>) {
  return <Bar.Separator className={cn("mx-1 h-4 w-px shrink-0 rounded-full bg-border", className)} {...props} />
}

export function ToolbarTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("select-none truncate px-1.5 text-sm font-medium text-foreground", className)} {...props} />
}

/** The empty canvas message. */
export function EmptyNote({ title, children, className }: { title: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-1.5 text-center", className)}>
      <div className="font-heading text-base font-semibold text-foreground">{title}</div>
      <p className="text-sm text-pretty text-muted-foreground">{children}</p>
    </div>
  )
}
