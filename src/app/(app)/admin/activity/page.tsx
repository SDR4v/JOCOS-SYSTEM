import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { humanizeEnum } from "@/lib/utils";

const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  CREATE: "default",
  UPDATE: "secondary",
  DELETE: "destructive",
};

export default async function ActivityPage() {
  await requireAdmin();

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { include: { employee: true } } },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Activity</h1>
        <p className="text-sm text-muted-foreground">
          Every create, update, and delete made across the system — most recent first.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
          ) : (
            <ul className="divide-y">
              {logs.map((log) => {
                const actorName = log.actor.employee?.name ?? log.actor.username;
                return (
                  <li key={log.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                    <div className="space-y-0.5">
                      <p className="text-sm">{log.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {actorName} ·{" "}
                        {log.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    </div>
                    <Badge variant={ACTION_VARIANT[log.action] ?? "secondary"}>{humanizeEnum(log.action)}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
