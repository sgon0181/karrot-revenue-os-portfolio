import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f2f5f3] p-5">
      <section className="card w-full max-w-md overflow-hidden text-center">
        <div className="panel-header justify-center"><span className="grid size-10 place-items-center rounded-full bg-white text-[#2f7a58]"><FileQuestion className="size-5" /></span></div>
        <div className="p-7">
          <p className="section-kicker">Record not found</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#183128]">This workspace item is unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-[#64726c]">It may have moved, been removed, or fall outside your current access.</p>
          <Link href="/dashboard" className="button-primary mt-6"><ArrowLeft className="size-4" /> Return to dashboard</Link>
        </div>
      </section>
    </main>
  );
}
