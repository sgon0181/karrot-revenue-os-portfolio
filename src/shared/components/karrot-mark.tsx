import clsx from "clsx";

export function KarrotMark({ className, labelled = false }: { className?: string; labelled?: boolean }) {
  return (
    <svg
      viewBox="0 0 32 36"
      className={clsx("karrot-mark shrink-0", className)}
      role={labelled ? "img" : undefined}
      aria-label={labelled ? "Karrot" : undefined}
      aria-hidden={labelled ? undefined : true}
    >
      <path className="karrot-mark__top" d="M5 5.2C5 4 6 3 7.2 3H27L14.2 17.2 5 5.2Z" fill="#69E2A4" />
      <path className="karrot-mark__bottom" d="M5 30.8C5 32 6 33 7.2 33H27L14.2 18.8 5 30.8Z" fill="#FF8059" />
      <path className="karrot-mark__spine" d="M5 5.2 14.2 17.2 5 30.8V5.2Z" fill="#35BE76" />
    </svg>
  );
}
