"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { ThemeContext, type Theme, type ThemeContextType } from './theme-context';

type ThemeProviderProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode
  defaultTheme?: Theme
  value?: string
}

const VALID_THEMES = new Set<Theme>(['dark', 'light', 'system', 'black']);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  value: _value,
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme")
      return (savedTheme && VALID_THEMES.has(savedTheme as Theme)
        ? savedTheme
        : defaultTheme) as Theme
    }
    return defaultTheme as Theme
  })

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark", "black")

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const handleChange = () => {
        root.classList.remove("light", "dark", "black")
        root.classList.add(mediaQuery.matches ? "dark" : "light")
      }
      handleChange()
      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }

    root.classList.add(theme)
  }, [theme])

  const value: ThemeContextType = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem("theme", theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeContext.Provider value={value} {...props}>
      {children}
    </ThemeContext.Provider>
  )
}
