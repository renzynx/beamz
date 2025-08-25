export const prefixWithCdn = (path: string, baseUrl: string | null) => {
  if (!baseUrl || !path) return "";

  const cdn = baseUrl.replace(/\/+$/, "");

  if (!cdn) return path;

  return `${cdn}${path.startsWith("/") ? path : `/${path}`}`;
};
