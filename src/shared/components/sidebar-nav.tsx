"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  CircleGauge,
  DatabaseZap,
  ListChecks,
  UsersRound,
} from "lucide-react";
import clsx from "clsx";
import { isNavigationItemActive } from "@/shared/lib/navigation-state";

const items = [
  { href: "/dashboard", label: "Home", mobileLabel: "Home", icon: CircleGauge },
  { href: "/tasks", label: "Tasks", mobileLabel: "Tasks", icon: ListChecks },
  { href: "/providers", label: "Providers", mobileLabel: "Providers", icon: Building2, relatedPaths: ["/search"] },
  { href: "/pipeline", label: "Pipeline", mobileLabel: "Pipeline", icon: ChartNoAxesCombined, relatedPaths: ["/opportunities"] },
  { href: "/customers", label: "Customers", mobileLabel: "Customers", icon: UsersRound },
  { href: "/visits", label: "Planner", mobileLabel: "Planner", icon: CalendarDays },
  { href: "/data-health", label: "Data health", mobileLabel: "Sources", icon: DatabaseZap },
];

export function SidebarNav({ variant = "rail" }: { variant?: "rail" | "mobile" }) {
  const pathname = usePathname();

  if (variant === "mobile") {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-50 grid h-[calc(68px+env(safe-area-inset-bottom))] grid-cols-7 border-t border-[#d2dfd9] bg-white px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(8,47,35,0.08)] md:hidden" aria-label="Primary navigation">
        {items.map(({ href, mobileLabel, icon: Icon, relatedPaths }) => {
          const active = isNavigationItemActive(pathname, href, relatedPaths);
          const current = pathname === href ? "page" : active ? "location" : undefined;
          return (
            <Link key={href} href={href} aria-current={current} className={clsx("relative flex min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-[9px] font-semibold transition-colors min-[360px]:text-[10px] min-[420px]:text-xs", active ? "text-[#134b35]" : "text-[#5f6f68]") }>
              <span className={clsx("absolute inset-x-[18%] top-0 h-[3px] rounded-b", active ? "bg-[#ff8059]" : "bg-transparent")} />
              <Icon className={clsx("size-5", active && "fill-[#dff8ec]")} />
              <span className="max-w-full truncate">{mobileLabel}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="space-y-1" aria-label="Primary navigation">
      {items.map(({ href, label, icon: Icon, relatedPaths }) => {
        const active = isNavigationItemActive(pathname, href, relatedPaths);
        const current = pathname === href ? "page" : active ? "location" : undefined;
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-current={current}
            className={clsx(
              "relative mx-2 flex min-h-[66px] flex-col items-center justify-center gap-1 rounded-[6px] px-1 text-center text-xs font-semibold leading-3 transition-[background-color,color] duration-150",
              active ? "bg-[#2f7a58] text-white" : "text-[#b7d2c6] hover:bg-white/7 hover:text-white",
            )}
          >
            {active ? <span className="absolute -left-2 top-0 h-full w-1 bg-[#ff8059]" aria-hidden="true" /> : null}
            <Icon className="size-5" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
