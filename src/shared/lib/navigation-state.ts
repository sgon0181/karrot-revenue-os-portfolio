export function isNavigationItemActive(
  pathname: string,
  href: string,
  relatedPaths: readonly string[] = [],
) {
  const matches = (candidate: string) =>
    pathname === candidate || pathname.startsWith(`${candidate}/`);

  return matches(href) || relatedPaths.some(matches);
}
