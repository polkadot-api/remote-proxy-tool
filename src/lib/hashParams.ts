export const getHashParams = (location?: Location) => {
  location = location ?? globalThis.location;
  if (location.hash) return new URLSearchParams(location.hash.slice(1));
  return new URLSearchParams();
};

export const setHashParams = (
  newParams: Record<string, string | null>,
  location?: Location
) => {
  const params = getHashParams(location);

  Object.entries(newParams).forEach(([param, value]) => {
    if (value === null) params.delete(param);
    else params.set(param, value);
  });

  location = location ?? globalThis.location;
  location.hash = "#" + params.toString();
};

export const getHashParam = (name: string) => getHashParams().get(name);
export const setHashParam = (name: string, value: string | null) =>
  setHashParams({
    [name]: value,
  });
