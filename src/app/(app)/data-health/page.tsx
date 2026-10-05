import { DataHealthWorkspace } from "@/features/data-health/components/data-health-workspace";
import type { DataHealthSearchParams } from "@/features/data-health/lib/pagination";

export default function DataHealthPage(props: {
  searchParams: Promise<DataHealthSearchParams>;
}) {
  return <DataHealthWorkspace {...props} />;
}
