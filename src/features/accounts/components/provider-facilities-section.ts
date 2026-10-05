import { createElement, type ReactNode } from "react";

/** The production anchor shell owned by the Overview tab's Facilities panel. */
export function ProviderFacilitiesSection({ children }: { children: ReactNode }) {
  return createElement(
    "section",
    {
      id: "facilities",
      className: "card scroll-mt-24",
    },
    children,
  );
}
