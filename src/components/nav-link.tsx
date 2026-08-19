"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  icon,
  children,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  badge?: number;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {icon}
      {children}
      {!!badge && badge > 0 && (
        <span
          className={cn(
            "flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[0.65rem] font-semibold",
            isActive ? "bg-primary-foreground text-primary" : "bg-destructive text-white",
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
