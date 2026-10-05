export function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export function required(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) throw new Error(`${key} is required`);
  return value;
}

export function httpUrl(formData: FormData, key: string) {
  const value = text(formData, key);
  if (value === null) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${key} must be a valid URL`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${key} must use http or https`);
  }
  return parsed.toString();
}
