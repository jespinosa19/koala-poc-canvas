export const FRAME_MIN_WIDTH = 240
export const FRAME_MAX_WIDTH = 3840
export const FRAME_MIN_HEIGHT = 160
export const FRAME_MAX_HEIGHT = 6000

/**
 * @param {number} width
 * @param {number} height
 * @returns {{ width: number, height: number }}
 */
export function clampFrameSize(width, height) {
  return {
    width: Math.round(Math.min(FRAME_MAX_WIDTH, Math.max(FRAME_MIN_WIDTH, width))),
    height: Math.round(Math.min(FRAME_MAX_HEIGHT, Math.max(FRAME_MIN_HEIGHT, height))),
  }
}
