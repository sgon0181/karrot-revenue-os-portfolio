import type { Metadata } from "next";
import { LandingExperience } from "@/features/landing/components/landing-experience";

// The public root is an independent proposal that names a real company, so it
// must carry its authorship in every surface a link preview can show and must
// never rank for the company's own brand searches.
export const metadata: Metadata = {
  title: { absolute: "A GTM Engine for Karrot Care | Santiago Gonzalez" },
  description:
    "An independent Founding GTM proposal by Santiago Gonzalez: a working commercial operating system that maps the NSW aged-care market, researches accounts with evidence, and runs the pipeline end to end.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "A GTM Engine for Karrot Care",
    description:
      "An independent Founding GTM proposal by Santiago Gonzalez. Working today: a register-backed market map, evidence-backed account intelligence with human review, pipeline, tasks and customer continuity.",
    type: "website",
  },
};

export default function Home() {
  return <LandingExperience />;
}
