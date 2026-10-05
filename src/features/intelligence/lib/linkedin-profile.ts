type LinkSource = { url: string };

export function linkedInPersonProfileUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const isLinkedInHost =
      hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
    const isPersonProfile = /^\/in\/[a-z0-9_-]+\/?$/i.test(url.pathname);

    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      !isLinkedInHost ||
      !isPersonProfile ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }

    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function linkedInPersonProfileFromSources(
  sources: readonly LinkSource[],
) {
  for (const source of sources) {
    const profileUrl = linkedInPersonProfileUrl(source.url);
    if (profileUrl) return profileUrl;
  }
  return null;
}
