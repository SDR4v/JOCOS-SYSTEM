"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markNotificationRead, markAllNotificationsRead } from "@/app/(app)/notifications-actions";

export type NotificationItem = {
  id: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: Date;
};

export function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const [, startTransition] = useTransition();

  function handleOpenItem(id: string, read: boolean) {
    if (read) return;
    startTransition(() => {
      markNotificationRead(id);
    });
  }

  function handleMarkAllRead() {
    startTransition(() => {
      markAllNotificationsRead();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(buttonVariants({ variant: "outline", size: "icon" }), "relative")}>
        <Bell />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end">
        <div className="flex items-center justify-between px-1.5 py-1">
          <span className="px-1.5 text-xs font-medium text-muted-foreground">Notifications</span>
          {unreadCount > 0 && (
            <Button type="button" variant="ghost" size="xs" onClick={handleMarkAllRead}>
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">No notifications yet</p>
        ) : (
          notifications.map((n) => {
            const body = (
              <div className="flex items-start gap-2 py-0.5">
                {!n.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />}
                <div className={n.read ? "pl-3.5" : ""}>
                  <p className="text-xs leading-snug">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground">{relativeTime(n.createdAt)}</p>
                </div>
              </div>
            );
            return (
              <DropdownMenuItem
                key={n.id}
                onClick={() => handleOpenItem(n.id, n.read)}
                render={n.link ? <Link href={n.link} /> : undefined}
              >
                {body}
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function relativeTime(date: Date): string {
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  return `${diffD}d ago`;
}
