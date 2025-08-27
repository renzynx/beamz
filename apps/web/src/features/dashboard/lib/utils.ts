export const prefixWithCdn = (path: string, baseUrl: string | null) => {
  if (!baseUrl) return path;

  const cdn = baseUrl.replace(/\/+$/, "");

  if (!cdn) return path;

  return `${cdn}${path.startsWith("/") ? path : `/${path}`}`;
};
