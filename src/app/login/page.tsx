import { Database, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { login } from "@/app/actions/auth";
import { LoginReturnTo } from "@/app/login/login-return-to";
import { KarrotMark } from "@/shared/components/karrot-mark";
import { SubmitButton } from "@/shared/components/submit-button";
import { safeSingleInternalPath } from "@/shared/lib/internal-navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const returnToValues = params.returnTo === undefined
    ? []
    : Array.isArray(params.returnTo) ? params.returnTo : [params.returnTo];
  const returnTo = safeSingleInternalPath(returnToValues);

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#dcefe5] text-[#173a2b]">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 4% 92%, rgba(10,64,43,.96) 0 17%, transparent 36%), radial-gradient(ellipse at 94% 88%, rgba(18,92,57,.92) 0 21%, transparent 43%), radial-gradient(circle at 72% 31%, rgba(255,255,255,.48) 0 4%, transparent 21%), linear-gradient(180deg, #dff3eb 0%, #b9ddca 44%, #558f6e 72%, #123f2e 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[46%] opacity-80"
        style={{
          background:
            "radial-gradient(ellipse at 10% 100%, #174f38 0 10%, transparent 11%), radial-gradient(ellipse at 25% 105%, #246447 0 16%, transparent 17%), radial-gradient(ellipse at 43% 105%, #0e422e 0 19%, transparent 20%), radial-gradient(ellipse at 67% 105%, #2c7450 0 18%, transparent 19%), radial-gradient(ellipse at 88% 104%, #174f38 0 23%, transparent 24%)",
        }}
      />

      <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-[#164d37]/15 bg-[#e9f5f0]/88 px-5 backdrop-blur-sm sm:px-8">
        <div className="flex items-center gap-2.5" aria-label="Karrot Revenue OS">
          <KarrotMark className="h-7 w-5" />
          <span className="text-[17px] font-bold tracking-[0.25em] text-[#164d37]">KARROT</span>
        </div>
        <p className="text-xs font-medium text-[#305b49] sm:text-sm">Revenue OS · Sign in</p>
      </header>

      <section className="relative z-10 grid flex-1 place-items-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[390px] rounded-[9px] border border-white/75 bg-white px-6 py-7 shadow-[0_18px_55px_rgba(9,45,30,0.24)] sm:px-8 sm:py-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex items-center justify-center gap-2 text-[#164d37]">
              <KarrotMark className="h-8 w-6" />
              <span className="text-[15px] font-bold tracking-[0.2em]">KARROT</span>
            </div>
            <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#172a22]">
              Welcome to Revenue OS
            </h1>
            <p className="mx-auto mt-2 max-w-[290px] text-[13px] leading-5 text-[#6a756f]">
              Sign in to access the internal, source-backed commercial workspace.
            </p>
          </div>

          {error ? (
            <div
              id="login-error"
              role="alert"
              className="mb-5 rounded-[6px] border border-[#f5c9c0] bg-[#fff4f1] px-3.5 py-3 text-[13px] leading-5 text-[#a23f2d]"
            >
              {error}
            </div>
          ) : null}

          <form action={login} className="space-y-4" aria-describedby={error ? "login-error" : undefined}>
            <LoginReturnTo returnTo={returnTo} />
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-[#344b40]">
                Email address
              </label>
              <div className="relative">
                <Mail aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#799087]" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  placeholder="you@company.com"
                  className="h-11 w-full rounded-[6px] border border-[#d9e2dd] bg-white pl-10 pr-3 text-sm text-[#172a22] outline-none transition placeholder:text-[#64726c] hover:border-[#b8c9c0] focus:border-[#1c7653] focus:ring-4 focus:ring-[#1c7653]/10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-[#344b40]">
                Password
              </label>
              <div className="relative">
                <LockKeyhole aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#799087]" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  className="h-11 w-full rounded-[6px] border border-[#d9e2dd] bg-white pl-10 pr-3 text-sm text-[#172a22] outline-none transition placeholder:text-[#64726c] hover:border-[#b8c9c0] focus:border-[#1c7653] focus:ring-4 focus:ring-[#1c7653]/10"
                />
              </div>
            </div>

            <SubmitButton
              className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[6px] bg-[#164d37] px-4 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(10,49,34,0.2)] transition hover:bg-[#103f2d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#21ad69]/25"
              pendingLabel="Signing in…"
            >
              <Sparkles aria-hidden="true" className="size-4 text-[#75e0a2]" />
              Continue securely
            </SubmitButton>
          </form>

          <div className="my-5 h-px bg-[#e8eeea]" />

          <div className="grid grid-cols-2 gap-3 text-xs leading-4 text-[#65736c]">
            <span className="flex items-center gap-2">
              <Database aria-hidden="true" className="size-3.5 shrink-0 text-[#1e9b60]" />
              Source-backed data
            </span>
            <span className="flex items-center justify-end gap-2 text-right">
              <ShieldCheck aria-hidden="true" className="size-3.5 shrink-0 text-[#1e9b60]" />
              Internal access only
            </span>
          </div>

          <p className="mt-5 text-center text-xs leading-4 text-[#64726c]">
            Public registration is disabled. Access is provisioned by your workspace administrator.
          </p>
        </div>
      </section>

      <footer className="relative z-10 flex min-h-12 shrink-0 items-center justify-between gap-4 border-t border-white/15 bg-[#103f2f]/76 px-5 py-3 text-xs text-white/72 backdrop-blur-sm sm:px-8">
        <span>© 2026 Karrot</span>
        <span className="hidden sm:inline">Precision intelligence for aged-care growth teams</span>
      </footer>
    </main>
  );
}
