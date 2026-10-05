import { InternalReturnToInput } from "@/shared/components/internal-return-to-input";
import { RETURN_TO_PARAM } from "@/shared/lib/internal-navigation";

export function LoginReturnTo({ returnTo }: { returnTo: string }) {
  return <InternalReturnToInput name={RETURN_TO_PARAM} returnTo={returnTo} />;
}
