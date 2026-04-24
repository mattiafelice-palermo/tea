"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  {
    href: "/components",
    label: "Components",
    icon: (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path
          d="M5 9.5 10 4l5 5.5-5 6L5 9.5Zm0 0h10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/projects",
    label: "Cell Builder",
    icon: (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path
          d="M6 5.5h8a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Zm3 0V4m2 1.5V4M8 14.5h4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/scenarios",
    label: "Scenario",
    icon: (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5 15.5V9.5m5 6V4.5m5 11v-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/modules",
    label: "Modules",
    icon: (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M4.5 6.5h11v7h-11zM8 6.5v7M12 6.5v7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/results",
    label: "Results",
    icon: (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M4.5 15.5h11M6 12l2-2 2 1 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function getPageTitle(pathname: string) {
  if (pathname === "/") {
    return "Battery TEA";
  }
  const match = navItems.find((item) => item.href !== "/" && pathname.startsWith(item.href));
  return match?.label ?? "Battery TEA";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pageTitle = getPageTitle(pathname);

  return (
    <div className={`app-shell ${sidebarOpen ? "sidebar-open" : "sidebar-collapsed"}`}>
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand-row">
            <div className="brand-block">
              <h1>Battery TEA</h1>
            </div>
            <button
              type="button"
              className="burger"
              aria-label={sidebarOpen ? "Collapse navigation" : "Expand navigation"}
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive =
              item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive ? "active" : ""}`}
                title={item.label}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="main-column">
        <header className="hero">
          <h2>{pageTitle}</h2>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
