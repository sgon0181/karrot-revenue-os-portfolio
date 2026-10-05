import { DisclosureDialog } from "@/shared/components/disclosure-dialog";

export function DisclosureForm({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return <DisclosureDialog label={label}>{children}</DisclosureDialog>;
}

export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}{required ? <span className="ml-0.5 text-[#d73b4b]" aria-hidden="true">*</span> : null}</span>
      <input className="input" name={name} type={type} defaultValue={defaultValue ?? ""} required={required} placeholder={placeholder} />
    </label>
  );
}

export function SelectField({
  label,
  name,
  defaultValue,
  required,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}{required ? <span className="ml-0.5 text-[#d73b4b]" aria-hidden="true">*</span> : null}</span>
      <select className="input" name={name} defaultValue={defaultValue ?? ""} required={required}>{children}</select>
    </label>
  );
}

export function TextAreaField({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <textarea className="input min-h-24 resize-y" name={name} defaultValue={defaultValue ?? ""} placeholder={placeholder} />
    </label>
  );
}
