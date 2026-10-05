export function googleMapsSearchUrl(address: string) {
  const query = address.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function googleMapsLocationUrl({
  address,
  latitude,
  longitude,
}: {
  address: string;
  latitude: number | null;
  longitude: number | null;
}) {
  const query = latitude !== null && longitude !== null
    ? `${latitude},${longitude}`
    : address.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
