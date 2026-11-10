"use client"

import * as React from "react"
import { ArrowCounterClockwise, Check, Robot, Trash, X } from "koala-icons"

import { cn } from "@/lib/utils"
import type { CanvasComment, CanvasCommentTarget, CanvasRequest } from "../store"
import { Button } from "@/components/ui/button"
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { TextareaField, TextareaRoot } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import { RequestRow } from "./canvas-requests"

export interface CommentDraft {
  frameId: string
  x: number
  y: number
  width?: number
  height?: number
  scrollX: number
  scrollY: number
  target?: CanvasCommentTarget
}

const clock = (iso: string) => {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const pinShape =
  "absolute -mt-3.5 -ml-3.5 flex size-7 items-center justify-center rounded-full font-mono text-xs font-semibold tabular-nums shadow-md ring-2 select-none"

export function CommentPin({
  comment,
  number,
  left,
  top,
  active,
  onOpenChange,
  onReply,
  onResolve,
  onDelete,
}: {
  comment: CanvasComment
  number: number
  left: number
  top: number
  active: boolean
  onOpenChange: (open: boolean) => void
  onReply: (text: string) => Promise<void>
  onResolve: (resolved: boolean) => Promise<void>
  onDelete: () => Promise<void>
}) {
  return (
    <Popover open={active} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Comment ${number}`}
          data-canvas-pin=""
          style={{ left, top }}
          className={cn(
            pinShape,
            "pointer-events-auto cursor-pointer outline-none transition-[translate,background-color,box-shadow] duration-fast ease-out",
            "before:absolute before:-inset-1.5 hover:-translate-y-0.5 hover:shadow-lg",
            "focus-visible:ring-brand",
            active
              ? "-translate-y-0.5 bg-popover text-foreground shadow-lg ring-brand"
              : comment.resolved
                ? "bg-popover text-muted-foreground ring-(--canvas-stroke)"
                : "bg-brand text-brand-foreground ring-background/80",
          )}
        >
          {comment.resolved ? <Check weight="bold" className="size-3.5" aria-hidden /> : number}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={10}
        updatePositionStrategy="always"
        onFocusOutside={(event) => event.preventDefault()}
        className="w-80"
      >
        <CommentThread
          comment={comment}
          number={number}
          onReply={onReply}
          onResolve={onResolve}
          onDelete={onDelete}
          onClose={() => onOpenChange(false)}
        />
      </PopoverContent>
    </Popover>
  )
}

function Author({ author, at }: { author: "owner" | "agent"; at: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {author === "agent" && <Robot weight="bold" className="size-3.5" aria-hidden />}
      <span className="font-medium text-foreground">{author === "agent" ? "Agent" : "You"}</span>
      <span className="tabular-nums">{clock(at)}</span>
    </div>
  )
}

export function CommentThread({
  comment,
  number,
  onReply,
  onResolve,
  onDelete,
  onClose,
}: {
  comment: CanvasComment
  number: number
  onReply: (text: string) => Promise<void>
  onResolve: (resolved: boolean) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
}) {
  const [reply, setReply] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    try {
      await task()
    } finally {
      setBusy(false)
    }
  }

  const submit = () =>
    run(async () => {
      if (!reply.trim()) return
      await onReply(reply)
      setReply("")
    })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium tabular-nums">Comment {number}</span>
        <div className="flex items-center gap-0.5">
          <Button
            size="xs"
            variant="subtle"
            iconOnly
            tooltip="Delete"
            aria-label="Delete comment"
            disabled={busy}
            onClick={() => run(onDelete)}
          >
            <Trash weight="bold" />
          </Button>
          <Button size="xs" variant="subtle" iconOnly tooltip="Close" aria-label="Close" onClick={onClose}>
            <X weight="bold" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Author author={comment.author} at={comment.createdAt} />
        <p className="text-sm text-pretty text-body">{comment.text}</p>
        {comment.width && comment.height ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            Area {comment.width} × {comment.height}
          </p>
        ) : null}
        {comment.target?.text ? (
          <p className="truncate font-mono text-xs text-muted-foreground" title={comment.target.selector}>
            on “{comment.target.text}”
          </p>
        ) : null}
      </div>

      {comment.replies.map((item) => (
        <div key={item.id} className="flex flex-col gap-1">
          <Author author={item.author} at={item.createdAt} />
          <p className="text-sm text-pretty text-body">{item.text}</p>
        </div>
      ))}

      {comment.resolved && comment.resolution && !comment.replies.some((item) => item.text === comment.resolution) ? (
        <p className="text-sm text-pretty text-muted-foreground">{comment.resolution}</p>
      ) : null}

      <TextareaRoot size="sm">
        <TextareaField
          autoResize
          rows={1}
          placeholder="Reply"
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              submit()
            }
          }}
        />
      </TextareaRoot>

      <div className="flex items-center justify-end gap-2">
        {comment.resolved ? (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => onResolve(false))}>
            <ArrowCounterClockwise weight="bold" />
            Reopen
          </Button>
        ) : (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => onResolve(true))}>
            <Check weight="bold" />
            Resolve
          </Button>
        )}
        <Button size="sm" disabled={busy || !reply.trim()} onClick={submit}>
          Reply
        </Button>
      </div>
    </div>
  )
}

export function DraftPin({
  left,
  top,
  number,
  onCancel,
  onSubmit,
}: {
  left: number
  top: number
  number: number
  onCancel: () => void
  onSubmit: (text: string) => Promise<void>
}) {
  const [text, setText] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  const submit = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      await onSubmit(text)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover open onOpenChange={(open) => !open && onCancel()}>
      <PopoverAnchor asChild>
        <span
          aria-hidden
          style={{ left, top }}
          className={cn(pinShape, "-translate-y-0.5 bg-popover text-foreground shadow-lg ring-brand")}
        >
          {number}
        </span>
      </PopoverAnchor>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={10}
        updatePositionStrategy="always"
        onFocusOutside={(event) => event.preventDefault()}
        className="w-80"
      >
        <div className="flex flex-col gap-3">
          <TextareaRoot size="sm">
            <TextareaField
              autoFocus
              autoResize
              rows={2}
              placeholder="Leave a comment for the agent"
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
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button size="sm" loading={busy} disabled={!text.trim()} onClick={submit}>
              Comment
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function CommentsPanel({
  comments,
  requests,
  frameOrder,
  numberOf,
  frameTitle,
  showResolved,
  onShowResolvedChange,
  onPick,
  onResolve,
  onPickRequest,
  onCancelRequest,
  onClose,
}: {
  comments: CanvasComment[]
  requests: CanvasRequest[]
  frameOrder: string[]
  numberOf: (id: string) => number
  frameTitle: (id: string) => string
  showResolved: boolean
  onShowResolvedChange: (value: boolean) => void
  onPick: (comment: CanvasComment) => void
  onResolve: (comment: CanvasComment, resolved: boolean) => void
  onPickRequest: (request: CanvasRequest) => void
  onCancelRequest: (request: CanvasRequest) => void
  onClose: () => void
}) {
  const asked = showResolved ? [] : requests
  const openCount = comments.filter((comment) => !comment.resolved).length
  const resolvedCount = comments.length - openCount
  const list = comments.filter((comment) => comment.resolved === showResolved)
  const groups = frameOrder
    .map((frameId) => ({ frameId, items: list.filter((comment) => comment.frameId === frameId) }))
    .filter((group) => group.items.length)

  return (
    <aside
      aria-label="Comments"
      className="absolute top-3 right-3 z-20 flex max-h-[calc(100%-1.5rem)] w-80 flex-col rounded-lg bg-popover text-popover-foreground shadow-lg ring-1 ring-border ring-inset [--surface:var(--popover)]"
    >
      <div className="flex flex-col gap-3 px-4 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Comments</h2>
          <Button size="xs" variant="subtle" iconOnly tooltip="Close" aria-label="Close comments" className="-mr-2" onClick={onClose}>
            <X weight="bold" />
          </Button>
        </div>
        <ToggleGroup
          type="single"
          variant="segmented"
          size="sm"
          value={showResolved ? "resolved" : "open"}
          onValueChange={(value) => value && onShowResolvedChange(value === "resolved")}
          aria-label="Filter comments"
          className="w-full"
        >
          <ToggleGroupItem value="open" className="flex-1 gap-1.5">
            Open
            <span className="text-muted-foreground tabular-nums">{openCount}</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="resolved" className="flex-1 gap-1.5">
            Resolved
            <span className="text-muted-foreground tabular-nums">{resolvedCount}</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1.5">
        {asked.length > 0 && (
          <section aria-label="Asked" className="pt-2">
            <h3 className="truncate px-2.5 pb-1 text-xs font-medium text-muted-foreground">Asked</h3>
            <ul className="flex flex-col">
              {asked.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  frameTitle={frameTitle}
                  onPick={() => onPickRequest(request)}
                  onCancel={() => onCancelRequest(request)}
                />
              ))}
            </ul>
          </section>
        )}
        {groups.length === 0 && asked.length > 0 ? null : groups.length === 0 ? (
          <p className="px-2.5 pt-2 pb-3 text-sm text-pretty text-muted-foreground">
            {showResolved
              ? "Nothing resolved yet."
              : comments.length
                ? "All caught up."
                : "Press C, then click or drag on a frame."}
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.frameId} aria-label={frameTitle(group.frameId)} className="pt-2">
              <h3 className="truncate px-2.5 pb-1 text-xs font-medium text-muted-foreground">
                {frameTitle(group.frameId)}
              </h3>
              <ul className="flex flex-col">
                {group.items.map((comment) => (
                  <CommentRow
                    key={comment.id}
                    comment={comment}
                    number={numberOf(comment.id)}
                    onPick={() => onPick(comment)}
                    onResolve={() => onResolve(comment, !comment.resolved)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </aside>
  )
}

function CommentRow({
  comment,
  number,
  onPick,
  onResolve,
}: {
  comment: CanvasComment
  number: number
  onPick: () => void
  onResolve: () => void
}) {
  const replies = comment.replies.length
  const isArea = Boolean(comment.width && comment.height)
  const meta = [replies ? `${replies} ${replies === 1 ? "reply" : "replies"}` : null, isArea ? "Area" : null].filter(Boolean)

  return (
    <li className="group relative flex gap-3 rounded-md px-2.5 py-2 transition-colors duration-fast ease-out hover:bg-accent has-[button:focus-visible]:bg-accent">
      <button
        type="button"
        onClick={onPick}
        aria-label={`Comment ${number}: ${comment.text}`}
        className="absolute inset-0 cursor-pointer rounded-md outline-none"
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[0.6875rem] font-semibold tabular-nums",
          comment.resolved ? "text-muted-foreground ring-1 ring-border" : "bg-brand text-brand-foreground",
        )}
      >
        {number}
      </span>
      <span className="pointer-events-none flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("line-clamp-3 text-sm text-pretty", comment.resolved ? "text-muted-foreground" : "text-body")}>
          {comment.text}
        </span>
        {meta.length ? <span className="text-xs text-muted-foreground tabular-nums">{meta.join(" · ")}</span> : null}
      </span>
      <span className="relative h-5 w-10 shrink-0">
        <span className="pointer-events-none absolute inset-0 flex items-center justify-end text-xs text-muted-foreground tabular-nums transition-[opacity,translate] duration-fast ease-out group-focus-within:-translate-y-1 group-focus-within:opacity-0 group-hover:-translate-y-1 group-hover:opacity-0">
          {clock(comment.createdAt)}
        </span>
        <Button
          size="xs"
          variant="subtle"
          iconOnly
          tooltip={comment.resolved ? "Reopen" : "Resolve"}
          aria-label={comment.resolved ? "Reopen comment" : "Resolve comment"}
          onClick={onResolve}
          className="pointer-events-none absolute top-1/2 right-0 -mt-3.5 -mr-1.5 translate-y-1 opacity-0 transition-[opacity,translate,background-color,color] duration-fast ease-out group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100"
        >
          {comment.resolved ? <ArrowCounterClockwise weight="bold" /> : <Check weight="bold" />}
        </Button>
      </span>
    </li>
  )
}
