import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/ThemeProvider"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: "var(--border-subtle)",
        color: "var(--text-secondary)",
        border: "none",
        cursor: "pointer",
        transition: "background-color 0.2s ease, color 0.2s ease",
      }}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  )
}
