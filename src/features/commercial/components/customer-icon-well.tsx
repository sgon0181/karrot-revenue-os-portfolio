export function CustomerIconWell({
  icon: Icon,
}: {
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <span
      className="grid size-9 shrink-0 place-items-center rounded-full border border-[#0f3f2f] bg-[#134b35] text-white shadow-[0_1px_2px_rgba(8,47,35,0.16)] ring-1 ring-[#9fc9b5] ring-offset-1 ring-offset-white"
      data-slot="customer-icon-well"
      aria-hidden="true"
    >
      <Icon className="size-[17px] stroke-[2]" />
    </span>
  );
}
