import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarForm } from "./avatar-form";

export default async function ProfilePage() {
  const user = await requireUser();
  const avatar = await prisma.userAvatar.findUnique({ where: { userId: user.id } });
  const avatarDataUri = avatar
    ? `data:${avatar.mimeType};base64,${Buffer.from(avatar.fileData).toString("base64")}`
    : null;

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">Your account details and profile photo.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{user.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {user.role === "ADMIN" ? "Administrator" : "COS Member"} &middot; {user.username}
          </p>
          <AvatarForm currentAvatar={avatarDataUri} initial={(user.name ?? user.username).charAt(0).toUpperCase()} />
        </CardContent>
      </Card>
    </div>
  );
}
