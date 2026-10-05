import clsx from "clsx";
import { ArrowUpRight, Inbox } from "lucide-react";
import Link from "next/link";

export function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "red" | "blue";
}) {
  const tones = {
    slate: "border-[#d9e1dd] bg-[#f3f6f4] text-[#52635b] before:bg-[#75847d]",
    green: "border-[#bce5ce] bg-[#e8f8ef] text-[#17623f] before:bg-[#14ae5c]",
    amber: "border-[#efdda4] bg-[#fff6d9] text-[#725300] before:bg-[#e4a919]",
    red: "border-[#f0c6ca] bg-[#fff0f1] text-[#a82938] before:bg-[#d73b4b]",
    blue: "border-[#cbdcf7] bg-[#edf4ff] text-[#285aaf] before:bg-[#2c68d7]",
  };
  return (
    <span className={clsx("inline-flex min-h-6 items-center gap-1.5 rounded-[5px] border px-2 py-0.5 text-xs font-semibold capitalize before:size-1.5 before:shrink-0 before:rounded-full", tones[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="grid min-h-44 place-items-center px-5 py-8 text-center">
      <div>
        <div className="mx-auto grid size-10 place-items-center rounded-[7px] border border-[#dce6e1] bg-[#f5f8f6] text-[#809087]"><Inbox className="size-[18px]" /></div>
        <h3 className="mt-3 text-sm font-semibold text-[#2c4037]">{title}</h3>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[#64726c]">{description}</p>
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}

export function SectionTitle({ id, title, description, action }: { id?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 id={id} className="text-[15px] font-semibold leading-5 text-[#244136]">{title}</h2>
        {description ? <p className="mt-0.5 text-xs leading-5 text-[#64726c]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 rounded-[4px] text-sm font-semibold text-[#1f6548] underline-offset-4 hover:text-[#0f3f2f] hover:underline">
      {children}<ArrowUpRight className="size-3.5" />
    </Link>
  );
}
