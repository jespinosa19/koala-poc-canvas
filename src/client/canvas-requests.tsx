"use client"

import * as React from "react"
import { CheckCircle, GitMerge, Sparkle, X } from "koala-icons"

import { cn } from "@/lib/utils"
import type { CanvasRequest, CanvasRequestKind, CanvasVerdict } from "../store"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { TextareaField, TextareaRoot } from "@/components/ui/textarea"
import { ToolbarButton } from "./canvas-toolbar"

const KIND: Record<
  CanvasRequestKind,
  { icon: typeof Sparkle; tooltip: string; title: (names: string[]) => string; placeholder: string; submit: string }
> = {
  more: {
    icon: Sparkle,
    tooltip: "More like this",
    title: ([name]) => `More like ${name}`,
    placeholder: "What to explore, if anything: bolder type, a denser grid, a darker ground…",
    submit: "Ask for variations",
  },
  mix: {
    icon: GitMerge,
    tooltip: "Mix",
    title: (names) => (names.length <= 3 ? `Mix ${names.join(" + ")}` : `Mix ${names.length} frames`),
    placeholder: "What to take from each: the header of A, the cards of C…",
    submit: "Ask for the mix",
  },
  decide: {
    icon: CheckCircle,
    tooltip: "Choose this",
    title: ([name]) => `Choose ${name}`,
    placeholder: "Why this one, in a sentence",
    submit: "Choose",
  },
}

export const VERDICT_LABEL: Record<CanvasVerdict, string> = { pick: "Pick", maybe: "Maybe", out: "Out" }

export function RequestButton({
  kind,
  names,
  shortcut,
  open,
  onOpenChange,
  onSubmit,
}: {
  kind: CanvasRequestKind
  names: string[]
  shortcut?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (text: string) => Promise<void>
}) {
  const meta = KIND[kind]
  const Icon = meta.icon
  const [text, setText] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const needsText = kind === "mix"

  const submit = async () => {
    if (busy || (needsText && !text.trim())) return
    setBusy(true)
    try {
      await onSubmit(text)
      setText("")
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <ToolbarButton tooltip={meta.tooltip} shortcut={shortcut} pressed={open}>
          <Icon weight="bold" />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="center" sideOffset={10} className="w-80">
        <div className="flex flex-col gap-3">
          <p className="truncate text-sm font-medium">{meta.title(names.map((name) => `“${name}”`))}</p>
          <TextareaRoot size="sm">
            <TextareaField
              autoFocus
              autoResize
              rows={2}
              placeholder={meta.placeholder}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  submit()
                }
              }}
            />
          </TextareaRoot>
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={busy} disabled={needsText && !text.trim()} onClick={submit}>
              {meta.submit}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function requestSummary(request: CanvasRequest, frameTitle: (id: string) => string) {
  const names = request.frameIds.map((id) => `“${frameTitle(id)}”`)
  return KIND[request.kind].title(names)
}

export function RequestRow({
  request,
  frameTitle,
  onPick,
  onCancel,
}: {
  request: CanvasRequest
  frameTitle: (id: string) => string
  onPick: () => void
  onCancel: () => void
}) {
  const Icon = KIND[request.kind].icon
  return (
    <li className="group relative flex gap-3 rounded-md px-2.5 py-2 transition-colors duration-fast ease-out hover:bg-accent has-[button:focus-visible]:bg-accent">
      <button
        type="button"
        onClick={onPick}
        aria-label={requestSummary(request, frameTitle)}
        className="absolute inset-0 cursor-pointer rounded-md outline-none"
      />
      <span
        aria-hidden
        className="pointer-events-none flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground"
      >
        <Icon weight="bold" className="size-3" />
      </span>
      <span className="pointer-events-none flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm text-body">{requestSummary(request, frameTitle)}</span>
        {request.text ? <span className="line-clamp-2 text-xs text-pretty text-muted-foreground">{request.text}</span> : null}
        <span className="text-xs text-muted-foreground">Waiting for the agent</span>
      </span>
      <Button
        size="xs"
        variant="subtle"
        iconOnly
        tooltip="Cancel request"
        aria-label="Cancel request"
        onClick={onCancel}
        className={cn(
          "relative -mr-1.5 opacity-0 transition-opacity duration-fast ease-out",
          "group-focus-within:opacity-100 group-hover:opacity-100",
        )}
      >
        <X weight="bold" />
      </Button>
    </li>
  )
}
