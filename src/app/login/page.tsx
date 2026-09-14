import Image from "next/image";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const callbackUrlRaw = params.callbackUrl;
  const callbackUrl = typeof callbackUrlRaw === "string" ? callbackUrlRaw : "/";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8">
      <Image
        src="/batac-cityhall.png"
        alt=""
        fill
        priority
        className="object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background/80 to-brand-gold/10" />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border shadow-xl">
        <div className="relative flex flex-col items-center gap-2 bg-primary px-6 pt-8 pb-7 text-center text-primary-foreground">
          <Image
            src="/batac-seal.jpg"
            alt="City of Batac Official Seal"
            width={72}
            height={72}
            className="rounded-full shadow-md ring-4 ring-primary-foreground/20"
            priority
          />
          <div>
            <h1 className="font-heading text-lg font-bold tracking-wide">JOCOS Attendance &amp; Payroll</h1>
            <p className="text-xs text-primary-foreground/75">City Government of Batac</p>
          </div>
        </div>
        <div className="h-1 bg-brand-gold" />
        <div className="bg-card px-6 py-6">
          <p className="mb-4 text-center text-sm text-muted-foreground">Sign in to continue</p>
          <LoginForm callbackUrl={callbackUrl} />
        </div>
      </div>
    </div>
  );
}
