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
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Image
            src="/batac-seal.jpg"
            alt="City of Batac Official Seal"
            width={72}
            height={72}
            className="mb-1 rounded-full"
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
