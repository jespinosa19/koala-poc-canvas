"use client"

import * as React from "react"

import { cubicBezier, duration, easingPoints } from "@/lib/motion"

import { clampZoom, gridStep, wheelDelta, zoomFactor, type Camera } from "./camera"

const flyEase = cubicBezier(easingPoints.inOut)
const SETTLE = 0.28

export function useCamera(viewportRef: React.RefObject<HTMLDivElement | null>, initial: Camera) {
  const [camera, setCamera] = React.useState<Camera>(initial)
  const cameraRef = React.useRef(camera)
  const zoomTarget = React.useRef<{ lz: number; sx: number; sy: number; wx: number; wy: number } | null>(null)
  const fly = React.useRef<{ from: Camera; to: Camera; start: number; length: number } | null>(null)
  const frame = React.useRef<number | null>(null)

  const commit = React.useCallback((next: Camera) => {
    cameraRef.current = next
    setCamera(next)
  }, [])

  const tickRef = React.useRef<() => void>(() => {})
  const loop = React.useCallback(() => tickRef.current(), [])

  const tick = React.useCallback(() => {
    frame.current = null
    const now = performance.now()
    if (fly.current) {
      const { from, to, start, length } = fly.current
      const t = Math.min(1, (now - start) / length)
      const e = flyEase(t)
      const view = viewportRef.current?.getBoundingClientRect()
      const cx = (view?.width ?? 0) / 2
      const cy = (view?.height ?? 0) / 2
      const fromCenter = { x: (cx - from.x) / from.z, y: (cy - from.y) / from.z }
      const toCenter = { x: (cx - to.x) / to.z, y: (cy - to.y) / to.z }
      const z = Math.exp(Math.log(from.z) + (Math.log(to.z) - Math.log(from.z)) * e)
      const wx = fromCenter.x + (toCenter.x - fromCenter.x) * e
      const wy = fromCenter.y + (toCenter.y - fromCenter.y) * e
      commit(t >= 1 ? to : { z, x: cx - wx * z, y: cy - wy * z })
      if (t < 1) frame.current = requestAnimationFrame(loop)
      else fly.current = null
      return
    }
    const target = zoomTarget.current
    if (!target) return
    const lz = Math.log(cameraRef.current.z)
    const done = Math.abs(target.lz - lz) < 0.002
    const z = Math.exp(done ? target.lz : lz + (target.lz - lz) * SETTLE)
    commit({ z, x: target.sx - target.wx * z, y: target.sy - target.wy * z })
    if (done) zoomTarget.current = null
    else frame.current = requestAnimationFrame(loop)
  }, [commit, loop, viewportRef])

  React.useLayoutEffect(() => {
    tickRef.current = tick
  }, [tick])

  const schedule = React.useCallback(() => {
    if (frame.current == null) frame.current = requestAnimationFrame(loop)
  }, [loop])

  const zoomAt = React.useCallback(
    (factor: number, sx: number, sy: number) => {
      fly.current = null
      const current = cameraRef.current
      const base = zoomTarget.current ? Math.exp(zoomTarget.current.lz) : current.z
      const next = clampZoom(base * factor)
      zoomTarget.current = {
        lz: Math.log(next),
        sx,
        sy,
        wx: (sx - current.x) / current.z,
        wy: (sy - current.y) / current.z,
      }
      schedule()
    },
    [schedule],
  )

  const zoomBy = React.useCallback(
    (factor: number) => {
      const view = viewportRef.current?.getBoundingClientRect()
      zoomAt(factor, (view?.width ?? 0) / 2, (view?.height ?? 0) / 2)
    },
    [viewportRef, zoomAt],
  )

  const panBy = React.useCallback(
    (dx: number, dy: number) => {
      fly.current = null
      zoomTarget.current = null
      const current = cameraRef.current
      commit({ ...current, x: current.x + dx, y: current.y + dy })
    },
    [commit],
  )

  const flyTo = React.useCallback(
    (to: Camera, instant = false) => {
      zoomTarget.current = null
      const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
      if (instant || reduce) {
        fly.current = null
        commit(to)
        return
      }
      fly.current = { from: cameraRef.current, to, start: performance.now(), length: duration.slow }
      schedule()
    },
    [commit, schedule],
  )

  React.useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement | null)?.closest?.("[data-canvas-ignore-wheel]")) return
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      const { dx, dy } = wheelDelta(event, rect.height)
      if (event.ctrlKey || event.metaKey) {
        zoomAt(zoomFactor(dy), event.clientX - rect.left, event.clientY - rect.top)
      } else if (event.shiftKey && dx === 0) {
        panBy(-dy, 0)
      } else {
        panBy(-dx, -dy)
      }
    }
    let gestureBase = 1
    const onGestureStart = (event: Event) => {
      event.preventDefault()
      gestureBase = 1
    }
    const onGestureChange = (event: Event) => {
      event.preventDefault()
      const gesture = event as Event & { scale: number; clientX: number; clientY: number }
      const rect = el.getBoundingClientRect()
      zoomAt(gesture.scale / gestureBase, gesture.clientX - rect.left, gesture.clientY - rect.top)
      gestureBase = gesture.scale
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    el.addEventListener("gesturestart", onGestureStart)
    el.addEventListener("gesturechange", onGestureChange)
    return () => {
      el.removeEventListener("wheel", onWheel)
      el.removeEventListener("gesturestart", onGestureStart)
      el.removeEventListener("gesturechange", onGestureChange)
    }
  }, [panBy, viewportRef, zoomAt])

  React.useEffect(
    () => () => {
      if (frame.current != null) cancelAnimationFrame(frame.current)
    },
    [],
  )

  const zoomTargetValue = React.useCallback(
    () => (zoomTarget.current ? Math.exp(zoomTarget.current.lz) : fly.current ? fly.current.to.z : cameraRef.current.z),
    [],
  )

  return { camera, cameraRef, zoomAt, zoomBy, panBy, flyTo, zoomTargetValue, grid: gridStep(camera.z) }
}
