import { useState, useEffect } from 'react'

/**
 * Detect iOS virtual keyboard by comparing visualViewport height
 * to window.innerHeight. Returns the keyboard height in pixels.
 * On non-iOS or when keyboard is hidden, returns 0.
 */
export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      // visualViewport.height shrinks when keyboard is visible
      // The difference is the keyboard height
      const kbHeight = Math.max(0, Math.round(window.innerHeight - vv.height))
      setKeyboardHeight(kbHeight)
    }

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return keyboardHeight
}
