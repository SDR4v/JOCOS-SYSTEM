"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
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
      data-active={isActive}
      className={cn(
        "relative z-10 flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
        isActive ? "text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <NavLinkBody icon={icon} isActive={isActive} badge={badge}>
        {children}
      </NavLinkBody>
    </Link>
  );
}

// useLinkStatus must be called from a child of <Link>, and it reflects the
// pending state of THIS link's own navigation — unlike loading.tsx, it fires
// on every click, not just the first time this route segment mounts.
function NavLinkBody({
  icon,
  children,
  badge,
  isActive,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  badge?: number;
  isActive: boolean;
}) {
  const { pending } = useLinkStatus();

  return (
    <>
      {pending ? <Loader2 className="size-4 animate-spin" /> : icon}
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
    </>
  );
}
