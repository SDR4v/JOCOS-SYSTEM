"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NavBadge, isNavActive } from "@/components/nav-link";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; icon: React.ReactNode; label: string; badge?: number };

// A desktop-bar dropdown for a handful of related pages, so the admin's dozen
// destinations fit on one row instead of wrapping into an unscannable block.
// The trigger carries data-active when the current page lives inside it, so
// LiquidNav's pill lands on the group the same way it does on a plain link,
// and it rolls up its items' badges so a pending count is never hidden
// behind a closed menu.
export function NavGroup({ label, icon, items }: { label: string; icon: React.ReactNode; items: NavItem[] }) {
  const pathname = usePathname();
  const isActive = items.some((item) => isNavActive(pathname, item.href));
  const badge = items.reduce((sum, item) => sum + (item.badge ?? 0), 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-active={isActive}
        className={cn(
          "relative z-10 flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive
            ? "text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground data-popup-open:bg-accent data-popup-open:text-foreground",
        )}
      >
        {icon}
        {label}
        <NavBadge count={badge} isActive={isActive} />
        <ChevronDown className="size-3.5 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-auto min-w-56">
        {items.map((item) => {
          const itemActive = isNavActive(pathname, item.href);
          return (
            <MenuPrimitive.LinkItem
              key={item.href}
              closeOnClick
              render={<Link href={item.href} />}
              aria-current={itemActive ? "page" : undefined}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg]:shrink-0",
                itemActive && "bg-primary/10 font-medium text-primary",
              )}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              <NavBadge count={item.badge} isActive={false} />
            </MenuPrimitive.LinkItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
