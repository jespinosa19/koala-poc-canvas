"use client"

import * as React from "react"

import { duration as motionDuration } from "@/lib/motion"

export type ToastVariant = "default" | "success" | "warning" | "destructive" | "info" | "loading"

export type ToastAppearance = "card" | "minimal"

export const TOAST_DURATION = 5000

export const ANCHORED_TOAST_DURATION = 1500

export interface ToastOptions {
  id?: string
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: ToastVariant
  duration?: number
  action?: { label: string; onClick: () => void }
  anchor?: HTMLElement | null
  appearance?: ToastAppearance
  countdown?: boolean
  progress?: number
}

export interface ToastAnchorRect {
  top: number
  bottom: number
  left: number
  width: number
}

export interface ToastData extends Omit<ToastOptions, "id" | "duration" | "anchor"> {
  id: string
  duration: number
  anchorRect?: ToastAnchorRect
  open: boolean
  replay: number
  epoch: number
  wasLoading: boolean
}

type Listener = () => void
const listeners = new Set<Listener>()
let _state: ToastData[] = []
const EMPTY: ToastData[] = []
const removals = new Map<string, ReturnType<typeof setTimeout>>()
const anchoredTimers = new Map<string, ReturnType<typeof setTimeout>>()

function emit() {
  listeners.forEach((fn) => fn())
}

function clearTimer(timers: Map<string, ReturnType<typeof setTimeout>>, id: string) {
  const timer = timers.get(id)
  if (timer === undefined) return
  clearTimeout(timer)
  timers.delete(id)
}

function rectOf(el: HTMLElement): ToastAnchorRect {
  const { top, bottom, left, width } = el.getBoundingClientRect()
  return { top, bottom, left, width }
}

export function addToast({ id: requested, anchor, ...content }: ToastOptions): string {
  const existing = requested === undefined ? undefined : _state.find((t) => t.id === requested)
  const anchorRect = anchor ? rectOf(anchor) : existing?.anchorRect
  const resolved =
    content.duration ??
    (content.variant === "loading" ? Infinity : anchorRect ? ANCHORED_TOAST_DURATION : TOAST_DURATION)

  let next: ToastData
  if (!existing) {
    next = {
      ...content,
      id: requested ?? crypto.randomUUID(),
      duration: resolved,
      anchorRect,
      open: true,
      replay: 0,
      epoch: 0,
      wasLoading: content.variant === "loading",
    }
  } else {
    clearTimer(removals, existing.id)
    next = {
      ...content,
      id: existing.id,
      duration: resolved,
      anchorRect,
      open: true,
      replay: existing.replay + 1,
      epoch: existing.duration !== Infinity && resolved === Infinity ? existing.epoch + 1 : existing.epoch,
      wasLoading: existing.wasLoading || content.variant === "loading",
    }
  }

  _state = [next, ..._state.filter((t) => t.id !== next.id)]
  clearTimer(anchoredTimers, next.id)
  if (next.anchorRect && Number.isFinite(resolved)) {
    const id = next.id
    anchoredTimers.set(
      id,
      setTimeout(() => {
        anchoredTimers.delete(id)
        startDismiss(id)
      }, resolved),
    )
  }
  emit()
  return next.id
}

export function startDismiss(id: string): void {
  if (!_state.some((t) => t.id === id && t.open)) return
  clearTimer(anchoredTimers, id)
  _state = _state.map((t) => (t.id === id ? { ...t, open: false } : t))
  emit()
  removals.set(
    id,
    setTimeout(() => {
      removals.delete(id)
      _state = _state.filter((t) => t.id !== id)
      emit()
    }, motionDuration.slow),
  )
}

export function dismissToast(id?: string): void {
  if (id !== undefined) return startDismiss(id)
  for (const t of _state) if (t.open) startDismiss(t.id)
}

export function dismissAnchoredToasts(): void {
  for (const t of _state) if (t.open && t.anchorRect) startDismiss(t.id)
}

export function useToastStore(): ToastData[] {
  return React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => _state,
    () => EMPTY,
  )
}

type ShortcutOptions = Omit<ToastOptions, "title" | "variant">

const shortcut = (variant: ToastVariant) => (title: React.ReactNode, opts?: ShortcutOptions) =>
  addToast({ ...opts, title, variant })

export type ToastPromiseResult<T> = React.ReactNode | ToastOptions | ((value: T) => React.ReactNode | ToastOptions)

export interface ToastPromiseMessages<T> {
  loading: React.ReactNode
  success: ToastPromiseResult<T>
  error: ToastPromiseResult<unknown>
}

function isOptions(value: unknown): value is ToastOptions {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !React.isValidElement(value)
}

function promiseToast<T>(
  promise: Promise<T> | (() => Promise<T>),
  messages: ToastPromiseMessages<T>,
  opts?: ShortcutOptions,
): Promise<T> {
  const id = addToast({ ...opts, title: messages.loading, variant: "loading", duration: Infinity })
  const settle = <V>(message: ToastPromiseResult<V>, value: V, variant: ToastVariant) => {
    const result = typeof message === "function" ? message(value) : message
    const content: ToastOptions = isOptions(result) ? result : { title: result }
    addToast({ ...opts, anchor: undefined, variant, ...content, id, duration: content.duration ?? opts?.duration })
  }
  const pending = typeof promise === "function" ? promise() : promise
  pending.then(
    (value) => settle(messages.success, value, "success"),
    (error: unknown) => settle(messages.error, error, "destructive"),
  )
  return pending
}

function show(input: string | ToastOptions, opts?: Omit<ToastOptions, "title">): string {
  return addToast(typeof input === "string" ? { ...opts, title: input } : input)
}

export const toast = Object.assign(show, {
  success: shortcut("success"),
  warning: shortcut("warning"),
  error: shortcut("destructive"),
  info: shortcut("info"),
  loading: shortcut("loading"),
  promise: promiseToast,
  dismiss: dismissToast,
})

export function useToast() {
  return { toast, dismiss: dismissToast }
}

export function __getToasts(): readonly ToastData[] {
  return _state
}

export function __resetToasts(): void {
  for (const timers of [removals, anchoredTimers]) {
    timers.forEach((timer) => clearTimeout(timer))
    timers.clear()
  }
  _state = []
  emit()
}
