"use client";

import { useTheme, type Theme } from "@/lib/theme-context";
import { Sun, Moon, Monitor } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface ThemeToggleProps {
  variant?: "icon-only" | "dropdown" | "pills";
}

export function ThemeToggle({ variant = "icon-only" }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (variant === "pills") {
    return (
      <div className="theme-pills">
        <style>{`
          .theme-pills {
            display: flex;
            align-items: center;
            background: var(--bg-tertiary);
            padding: 3px;
            border-radius: var(--radius-sm, 8px);
            border: 1px solid var(--border-color);
            gap: 2px;
          }
          .theme-pill-btn {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 6px 10px;
            border-radius: 6px;
            border: none;
            background: transparent;
            color: var(--text-secondary);
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            font-family: inherit;
            min-height: 34px;
          }
          .theme-pill-btn:hover {
            color: var(--text-primary);
          }
          .theme-pill-btn.active {
            background: var(--card-bg);
            color: var(--brand-500);
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            font-weight: 600;
          }
        `}</style>
        <button
          className={`theme-pill-btn ${theme === "light" ? "active" : ""}`}
          onClick={() => setTheme("light")}
          title="Light mode"
          type="button"
        >
          <Sun size={14} />
          <span>Light</span>
        </button>
        <button
          className={`theme-pill-btn ${theme === "dark" ? "active" : ""}`}
          onClick={() => setTheme("dark")}
          title="Dark mode"
          type="button"
        >
          <Moon size={14} />
          <span>Dark</span>
        </button>
        <button
          className={`theme-pill-btn ${theme === "system" ? "active" : ""}`}
          onClick={() => setTheme("system")}
          title="System theme"
          type="button"
        >
          <Monitor size={14} />
          <span>Auto</span>
        </button>
      </div>
    );
  }

  const toggleQuickTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <div className="theme-toggle-wrapper" ref={dropdownRef}>
      <style>{`
        .theme-toggle-wrapper {
          position: relative;
          display: inline-block;
        }
        .theme-toggle-btn {
          width: 36px;
          height: 36px;
          min-width: 36px;
          min-height: 36px;
          border-radius: 10px;
          border: 1px solid var(--border-color);
          background: var(--card-bg);
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .theme-toggle-btn:hover {
          color: var(--brand-500);
          border-color: var(--brand-300);
          background: var(--bg-tertiary);
          transform: translateY(-1px);
        }
        .theme-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 6px);
          z-index: 60;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm, 8px);
          box-shadow: var(--shadow-lg);
          padding: 4px;
          min-width: 140px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .theme-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          width: 100%;
          text-align: left;
          transition: all 0.15s ease;
          font-family: inherit;
        }
        .theme-option:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }
        .theme-option.active {
          background: var(--brand-50, rgba(99, 102, 241, 0.1));
          color: var(--brand-500);
          font-weight: 600;
        }
      `}</style>
      <button
        className="theme-toggle-btn"
        onClick={() => {
          if (variant === "dropdown") setOpen(!open);
          else toggleQuickTheme();
        }}
        title={`Current theme: ${theme} (Click to switch)`}
        aria-label="Toggle dark mode"
        type="button"
      >
        {resolvedTheme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      {open && variant === "dropdown" && (
        <div className="theme-menu">
          <button
            className={`theme-option ${theme === "light" ? "active" : ""}`}
            onClick={() => {
              setTheme("light");
              setOpen(false);
            }}
            type="button"
          >
            <Sun size={15} />
            <span>Light</span>
          </button>
          <button
            className={`theme-option ${theme === "dark" ? "active" : ""}`}
            onClick={() => {
              setTheme("dark");
              setOpen(false);
            }}
            type="button"
          >
            <Moon size={15} />
            <span>Dark</span>
          </button>
          <button
            className={`theme-option ${theme === "system" ? "active" : ""}`}
            onClick={() => {
              setTheme("system");
              setOpen(false);
            }}
            type="button"
          >
            <Monitor size={15} />
            <span>System</span>
          </button>
        </div>
      )}
    </div>
  );
}
