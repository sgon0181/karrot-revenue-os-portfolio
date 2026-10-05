import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";

export function CommercialEmptyState({
  title,
  description,
  href,
  actionLabel,
}: {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <div className="grid min-h-44 place-items-center px-5 py-8 text-center">
      <div>
        <div className="mx-auto grid size-10 place-items-center rounded-[7px] border border-[#dce6e1] bg-[#f5f8f6] text-[#809087]">
          <Inbox className="size-[18px]" aria-hidden />
        </div>
        <h3 className="mt-3 text-sm font-semibold text-[#2c4037]">{title}</h3>
        <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[#64726c]">{description}</p>
        <Link href={href} className="button-secondary mt-4">
          {actionLabel} <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
