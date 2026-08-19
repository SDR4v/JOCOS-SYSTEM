import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const callbackUrlRaw = params.callbackUrl;
  const callbackUrl = typeof callbackUrlRaw === "string" ? callbackUrlRaw : "/";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/5 via-background to-brand-gold/5 px-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="items-center text-center">
          <Image
            src="/batac-seal.jpg"
            alt="City of Batac Official Seal"
            width={80}
            height={80}
            className="mb-1 rounded-full shadow-sm"
            priority
          />
          <CardTitle className="text-xl">JOCOS Attendance &amp; Payroll</CardTitle>
          <p className="text-sm text-muted-foreground">City Government of Batac &middot; Sign in to continue</p>
        </CardHeader>
        <CardContent>
          <LoginForm callbackUrl={callbackUrl} />
        </CardContent>
      </Card>
    </div>
  );
}
