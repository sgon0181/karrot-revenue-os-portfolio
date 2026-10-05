export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-4 border-b border-[#d8e3de] pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="section-kicker mb-1.5">{eyebrow}</p> : null}
        <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.025em] text-[#183128] sm:text-[28px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-4xl text-[13px] leading-5 text-[#64726c]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
