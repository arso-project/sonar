import { ResizeObserver } from '@juggle/resize-observer'
import { useSize as useSizeModern } from 'web-api-hooks'

// This adds a polyfill for ResizeObserver, as browser
// support is not yet good enough (no Edge, no Firefox on Android).
// TODO: Remove once browser support is good enough.
export default function useSize (ref) {
  return useSizeModern(ref, ResizeObserver)
}
