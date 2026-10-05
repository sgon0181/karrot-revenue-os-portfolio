export const DEFAULT_INTERNAL_PATH = "/dashboard";
export const RETURN_TO_PARAM = "returnTo";

const INTERNAL_ORIGIN = "https://internal.karrot.invalid";
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f-\u009f]/u;
const MAX_COMPONENT_DECODE_PASSES = 4;
const MAX_RETURN_TO_DEPTH = 4;

function rawPathname(value: string) {
  const queryIndex = value.indexOf("?");
  const hashIndex = value.indexOf("#");
  const end = Math.min(
    queryIndex === -1 ? value.length : queryIndex,
    hashIndex === -1 ? value.length : hashIndex,
  );
  return value.slice(0, end);
}

function hasDotPathSegment(pathname: string) {
  return pathname.split("/").some((segment) => segment === "." || segment === "..");
}

function rawQuery(value: string) {
  const queryIndex = value.indexOf("?");
  const hashIndex = value.indexOf("#");
  if (queryIndex === -1 || (hashIndex !== -1 && hashIndex < queryIndex)) {
    return null;
  }
  return value.slice(queryIndex + 1, hashIndex === -1 ? value.length : hashIndex);
}

function rawFragment(value: string) {
  const hashIndex = value.indexOf("#");
  return hashIndex === -1 ? null : value.slice(hashIndex + 1);
}

function decodedEncodedComponent(value: string): string | null {
  let candidate = value;
  for (let pass = 0; pass <= MAX_COMPONENT_DECODE_PASSES; pass += 1) {
    if (candidate.includes("\\") || CONTROL_CHARACTER.test(candidate)) return null;

    let decoded: string;
    try {
      decoded = decodeURIComponent(candidate);
    } catch {
      return null;
    }
    if (decoded === candidate) return candidate;
    if (pass === MAX_COMPONENT_DECODE_PASSES) return null;
    candidate = decoded;
  }
  return null;
}

function decodeFormComponentOnce(value: string) {
  try {
    return decodeURIComponent(value.replaceAll("+", " "));
  } catch {
    return null;
  }
}

/** Parses only literal outer delimiters; encoded delimiters remain component data. */
function parsedOuterReturnTargets(value: string): string[] | null {
  const query = rawQuery(value);
  if (query === null) return [];

  const returnTargets: string[] = [];
  for (const entry of query.split("&")) {
    const separatorIndex = entry.indexOf("=");
    const key = separatorIndex === -1 ? entry : entry.slice(0, separatorIndex);
    const componentValue = separatorIndex === -1 ? "" : entry.slice(separatorIndex + 1);
    const decodedKey = decodeFormComponentOnce(key);
    const fullyDecodedKey = decodedEncodedComponent(key);
    if (
      decodedKey === null
      || fullyDecodedKey === null
      || decodedEncodedComponent(componentValue) === null
      || (decodedKey !== RETURN_TO_PARAM && fullyDecodedKey === RETURN_TO_PARAM)
    ) {
      return null;
    }
    if (decodedKey === RETURN_TO_PARAM) {
      const decodedValue = decodeFormComponentOnce(componentValue);
      if (decodedValue === null) return null;
      returnTargets.push(decodedValue);
    }
  }
  return returnTargets;
}

function isValidPathname(pathname: string) {
  let candidate = pathname;
  for (let pass = 0; pass <= MAX_COMPONENT_DECODE_PASSES; pass += 1) {
    if (
      !candidate.startsWith("/")
      || candidate.startsWith("//")
      || candidate.includes("?")
      || candidate.includes("#")
      || candidate.includes("\\")
      || CONTROL_CHARACTER.test(candidate)
      || hasDotPathSegment(candidate)
    ) {
      return false;
    }

    try {
      const canonical = new URL(candidate, INTERNAL_ORIGIN);
      if (
        canonical.origin !== INTERNAL_ORIGIN
        || !canonical.pathname.startsWith("/")
        || canonical.pathname.startsWith("//")
        || canonical.pathname.includes("\\")
        || CONTROL_CHARACTER.test(canonical.pathname)
        || hasDotPathSegment(canonical.pathname)
      ) {
        return false;
      }
    } catch {
      return false;
    }

    let decoded: string;
    try {
      decoded = decodeURIComponent(candidate);
    } catch {
      return false;
    }
    // The caller already removed literal query/fragment delimiters. Any such
    // delimiter revealed here was encoded inside the path and could hide the
    // remaining decoded path from URL parsing or dot-segment checks.
    if (decoded.includes("?") || decoded.includes("#")) return false;
    if (decoded === candidate) return true;
    if (pass === MAX_COMPONENT_DECODE_PASSES) return false;
    candidate = decoded;
  }
  return false;
}

function isValidInternalUrl(value: string, returnToDepth: number): boolean {
  if (
    returnToDepth > MAX_RETURN_TO_DEPTH
    || !value.startsWith("/")
    || value.startsWith("//")
    || value.includes("\\")
    || CONTROL_CHARACTER.test(value)
  ) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(value, INTERNAL_ORIGIN);
  } catch {
    return false;
  }

  const returnTargets = parsedOuterReturnTargets(value);
  if (
    parsed.origin !== INTERNAL_ORIGIN
    || returnTargets === null
    || returnTargets.length > 1
    || !isValidPathname(rawPathname(value))
    || decodedEncodedComponent(rawFragment(value) ?? "") === null
  ) {
    return false;
  }

  // A return target is a new URL structure, not another decode of its parent.
  return returnTargets.length === 0
    || isValidInternalUrl(returnTargets[0], returnToDepth + 1);
}

/**
 * Returns an unchanged same-app path, or null when the value could escape the
 * app or cannot be decoded safely. Keeping the original string preserves its
 * query and fragment exactly as supplied.
 */
export function validatedInternalPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return isValidInternalUrl(value, 0) ? value : null;
}

/** Accepts exactly one value; missing and duplicate boundary parameters fail closed. */
export function validatedSingleInternalPath(
  values: readonly unknown[],
): string | null {
  return values.length === 1 ? validatedInternalPath(values[0]) : null;
}

export function safeSingleInternalPath(
  values: readonly unknown[],
  fallback: string = DEFAULT_INTERNAL_PATH,
): string {
  return validatedSingleInternalPath(values)
    ?? validatedInternalPath(fallback)
    ?? DEFAULT_INTERNAL_PATH;
}

export function safeInternalPath(
  value: unknown,
  fallback: string = DEFAULT_INTERNAL_PATH,
): string {
  return validatedInternalPath(value)
    ?? validatedInternalPath(fallback)
    ?? DEFAULT_INTERNAL_PATH;
}

/** Preserves a browser-only fragment without weakening internal-path checks. */
export function withInheritedHash(value: unknown, hash: unknown): string | null {
  const path = validatedInternalPath(value);
  if (
    !path
    || typeof hash !== "string"
    || !hash.startsWith("#")
    || path.includes("#")
  ) {
    return path;
  }

  return validatedInternalPath(`${path}${hash}`) ?? path;
}

/** Retains query/hash context only when the destination owns the expected route. */
export function samePathInternalPath(
  value: unknown,
  expectedPathname: string,
): string | null {
  const path = validatedInternalPath(value);
  const expected = validatedInternalPath(expectedPathname);
  if (!path || !expected) return null;

  const url = new URL(path, INTERNAL_ORIGIN);
  const expectedUrl = new URL(expected, INTERNAL_ORIGIN);
  return url.pathname === expectedUrl.pathname ? path : null;
}

type ReturnToFormData = Pick<FormData, "getAll">;

const UUID_PATH_SEGMENT = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function providerWorkspaceFormReturnPath(
  formData: ReturnToFormData,
  providerId: string,
) {
  const candidate = validatedSingleInternalPath(formData.getAll("return_to"));
  return samePathInternalPath(
    candidate,
    `/providers/${encodeURIComponent(providerId)}`,
  );
}

function providerOrOpportunityFormReturnPath(
  formData: ReturnToFormData,
  providerId: string,
  verifiedOpportunityId: string | null,
) {
  const providerPath = providerWorkspaceFormReturnPath(formData, providerId);
  if (providerPath) return providerPath;
  if (!verifiedOpportunityId) return null;

  const candidate = validatedSingleInternalPath(formData.getAll("return_to"));
  return samePathInternalPath(
    candidate,
    `/opportunities/${encodeURIComponent(verifiedOpportunityId)}`,
  );
}

/** Returns the opportunity identifier requested as a mutation origin, before DB verification. */
export function mutationReturnOpportunityId(
  formData: ReturnToFormData,
): string | null {
  const candidate = validatedSingleInternalPath(formData.getAll("return_to"));
  if (!candidate) return null;

  const pathname = new URL(candidate, INTERNAL_ORIGIN).pathname;
  const match = pathname.match(/^\/opportunities\/([^/]+)$/);
  if (!match || !UUID_PATH_SEGMENT.test(match[1])) return null;
  return match[1].toLowerCase();
}

export function saveContactReturnPath(
  formData: ReturnToFormData,
  providerId: string,
) {
  return providerWorkspaceFormReturnPath(formData, providerId);
}

export function createOpportunityReturnPath(
  formData: ReturnToFormData,
  providerId: string,
) {
  return providerWorkspaceFormReturnPath(formData, providerId);
}

export function logActivityReturnPath(
  formData: ReturnToFormData,
  providerId: string,
  verifiedOpportunityId: string | null,
) {
  return providerOrOpportunityFormReturnPath(
    formData,
    providerId,
    verifiedOpportunityId,
  );
}

export function createNextActionReturnPath(
  formData: ReturnToFormData,
  providerId: string,
  verifiedOpportunityId: string | null,
) {
  return providerOrOpportunityFormReturnPath(
    formData,
    providerId,
    verifiedOpportunityId,
  );
}

export function updateCustomerReturnPath(
  formData: ReturnToFormData,
  providerId: string,
) {
  return providerWorkspaceFormReturnPath(formData, providerId);
}

export function addCustomerFacilityReturnPath(
  formData: ReturnToFormData,
  providerId: string,
) {
  return providerWorkspaceFormReturnPath(formData, providerId);
}

const TASK_FILTERS = new Set([
  "open",
  "mine",
  "today",
  "overdue",
  "upcoming",
  "completed",
]);

/** Accepts the Tasks route, its one allow-listed filter, and an optional hash. */
export function validatedTasksPath(value: unknown): string | null {
  const path = samePathInternalPath(value, "/tasks");
  if (!path) return null;

  const url = new URL(path, INTERNAL_ORIGIN);
  const queryKeys = [...url.searchParams.keys()];
  if (queryKeys.length === 0) return path;
  if (
    queryKeys.some((key) => key !== "filter")
    || url.searchParams.getAll("filter").length !== 1
    || !TASK_FILTERS.has(url.searchParams.get("filter") ?? "")
  ) {
    return null;
  }
  return path;
}

/** Adds an optional validated return target without disturbing other context. */
export function withReturnTo(destination: string, returnTo: unknown): string {
  const safeDestination = safeInternalPath(destination);
  const safeReturnTo = validatedInternalPath(returnTo);
  const url = new URL(safeDestination, INTERNAL_ORIGIN);
  if (!safeReturnTo && !url.searchParams.has(RETURN_TO_PARAM)) return safeDestination;

  // A single canonical value avoids conflicting duplicate/copied parameters.
  url.searchParams.delete(RETURN_TO_PARAM);
  if (safeReturnTo) url.searchParams.set(RETURN_TO_PARAM, safeReturnTo);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Builds the only login URL shape emitted by the auth boundary. */
export function loginPath(returnTo: unknown, error?: string): string {
  const path = withReturnTo("/login", safeInternalPath(returnTo));
  if (!error) return path;

  const url = new URL(path, INTERNAL_ORIGIN);
  url.searchParams.set("error", error);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Provides a stable, non-user-controlled label for return links. */
export function internalPathLabel(value: unknown): string | null {
  const path = validatedInternalPath(value);
  if (!path) return null;

  const pathname = new URL(path, INTERNAL_ORIGIN).pathname;
  if (pathname === "/" || pathname === "/dashboard") return "Home";
  if (pathname === "/tasks" || pathname.startsWith("/tasks/")) return "Tasks";
  if (pathname === "/providers") return "Providers";
  if (pathname.startsWith("/providers/")) return "Provider";
  if (pathname === "/pipeline" || pathname.startsWith("/pipeline/")) return "Pipeline";
  if (pathname.startsWith("/opportunities/")) return "Opportunity";
  if (pathname === "/customers" || pathname.startsWith("/customers/")) return "Customers";
  if (pathname === "/visits" || pathname.startsWith("/visits/")) return "Visits";
  if (pathname === "/search") return "Search results";
  if (pathname === "/data-health") return "Data health";
  return "previous page";
}
