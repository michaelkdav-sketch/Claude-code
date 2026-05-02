'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'aw-favorites'

export function useFavorites() {
  const [favs, setFavs] = useState<Set<string>>(new Set())

  // Initialize from localStorage after mount (SSR-safe)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setFavs(new Set(JSON.parse(raw) as string[]))
    } catch {}
  }, [])

  const toggle = (hex: string) => {
    setFavs((prev) => {
      const next = new Set(prev)
      if (next.has(hex)) {
        next.delete(hex)
      } else {
        next.add(hex)
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
  }

  const isFavorite = (hex: string) => favs.has(hex)

  return { favs, toggle, isFavorite }
}
