import { useFrame } from '@react-three/fiber'
import { useStore } from '../state/store'

let pending: ((url: string) => void)[] = []

/** Grab the current 3D frame as a small JPEG (used for compare cards and tickets). */
export function captureView(): Promise<string> {
  return new Promise((resolve) => pending.push(resolve))
}

/** Wait for the camera to finish its flight (max ~3 s), then capture. */
export async function captureSettledView(): Promise<string> {
  for (let i = 0; i < 30 && !useStore.getState().cameraSettled; i++) await new Promise((r) => setTimeout(r, 100))
  return captureView()
}

export function Capture() {
  // Runs after the post-processing pass (priority 1), while the frame is
  // still in the drawing buffer.
  useFrame(({ gl }) => {
    if (!pending.length) return
    const src = gl.domElement
    const w = 640
    const h = Math.round((w * src.height) / src.width)
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d')!.drawImage(src, 0, 0, w, h)
    const url = c.toDataURL('image/jpeg', 0.82)
    pending.forEach((r) => r(url))
    pending = []
  }, 2)
  return null
}
