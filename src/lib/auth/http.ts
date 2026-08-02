export function json(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

export function error(
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
): Response {
  return json({ error: message, ...extra }, status);
}
