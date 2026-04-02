import { useState, useEffect } from 'react'

/**
 * Returns the visible viewport height, accounting for virtual keyboards
 * on both iOS and Android. Uses visualViewport API which works cross-platform.
 * Returns null when no adjustment is needed (keyboard hidden).
 */
export function useKeyboardHeight() {
  const [viewportHeight, setViewportHeight] = useState<number | null>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      // On Android Chrome, window.innerHeight doesn't change when keyboard opens,
      // but visualViewport.height does. On iOS, both change but at different times.
      // Using visualViewport.height directly is the most reliable approach.
      const kbHeight = Math.max(0, Math.round(window.innerHeight - vv.height))
      
      if (kbHeight > 50) {
        // Keyboard is visible — use visualViewport height
        setViewportHeight(Math.round(vv.height))
      } else {
        setViewportHeight(null)
      }
    }

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return viewportHeight
}
