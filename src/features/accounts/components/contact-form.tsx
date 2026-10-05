import { saveContact } from "@/features/accounts/server/actions";
import { Field, SelectField, TextAreaField } from "@/shared/components/forms";
import { InternalReturnToInput } from "@/shared/components/internal-return-to-input";
import { SubmitButton } from "@/shared/components/submit-button";

type ContactFacilityOption = { id: string; name: string };

type ContactFormValue = {
  id: string;
  full_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  facility_id: string | null;
  role_category: string | null;
  relationship_status: string | null;
  professional_profile_url: string | null;
  source_type: string | null;
  source_url: string | null;
  last_verified_at: string | null;
  notes: string | null;
  record_mode: string;
};

function HttpUrlField({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string | null }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        className="input"
        name={name}
        type="url"
        inputMode="url"
        pattern="https?://.*"
        title="Enter a complete http:// or https:// URL"
        defaultValue={defaultValue ?? ""}
      />
    </label>
  );
}

export function ContactForm({
  providerId,
  facilities,
  contact,
  defaultFacilityId,
  returnFacilityId,
  returnTab,
  returnTo,
}: {
  providerId: string;
  facilities: ContactFacilityOption[];
  contact?: ContactFormValue;
  defaultFacilityId?: string;
  returnFacilityId?: string;
  returnTab?: "overview" | "people" | "intelligence" | "commercial" | "evidence";
  returnTo?: string;
}) {
  return (
    <form action={saveContact} className="space-y-4">
      <input type="hidden" name="provider_id" value={providerId} />
      {(returnFacilityId ?? defaultFacilityId) ? <input type="hidden" name="return_facility_id" value={returnFacilityId ?? defaultFacilityId} /> : null}
      {returnTab ? <input type="hidden" name="return_tab" value={returnTab} /> : null}
      {returnTo ? <InternalReturnToInput returnTo={returnTo} /> : null}
      {contact ? <input type="hidden" name="contact_id" value={contact.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="full_name" defaultValue={contact?.full_name} required />
        <Field label="Title" name="title" defaultValue={contact?.title} />
        <Field label="Email" name="email" type="email" defaultValue={contact?.email} />
        <Field label="Phone" name="phone" type="tel" defaultValue={contact?.phone} />
        <SelectField label="Facility (optional)" name="facility_id" defaultValue={contact?.facility_id ?? defaultFacilityId}>
          <option value="">Provider-wide</option>
          {facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
        </SelectField>
        <Field label="Role category" name="role_category" defaultValue={contact?.role_category} placeholder="CEO, Director of Nursing…" />
        <Field label="Relationship" name="relationship_status" defaultValue={contact?.relationship_status} placeholder="Known, introduced, champion…" />
        <HttpUrlField label="Professional profile URL" name="professional_profile_url" defaultValue={contact?.professional_profile_url} />
        <Field label="Source type" name="source_type" defaultValue={contact?.source_type} placeholder="Provider website, annual report…" />
        <HttpUrlField label="Source URL" name="source_url" defaultValue={contact?.source_url} />
        <Field label="Last verified" name="last_verified_at" type="date" defaultValue={contact?.last_verified_at?.slice(0, 10)} />
      </div>
      <TextAreaField label="Notes" name="notes" defaultValue={contact?.notes} />
      <SubmitButton pendingLabel={contact ? "Saving contact…" : "Adding contact…"}>{contact ? "Save contact" : "Add contact"}</SubmitButton>
    </form>
  );
}
