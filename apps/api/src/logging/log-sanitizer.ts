const allowedFields = new Set([
  'event',
  'requestId',
  'conversationId',
  'turnId',
  'status',
  'httpStatus',
  'method',
  'route',
  'durationMs',
  'dependency',
  'code',
  'reason',
  'upstreamStatus',
  'storageCode',
  'fields',
  'cached',
  'action',
  'searches',
  'groups',
  'products',
  'candidates',
  'truncated',
  'resource',
  'cacheHit',
  'count',
  'provider',
  'timeoutMs',
  'port',
  'stackFrames',
]);

export function sanitizeLogText(text: string): string {
  let safe = text;
  for (const secret of [process.env.GEMINI_API_KEY, process.env.OPENAI_API_KEY]) {
    if (secret && secret.length >= 8) safe = safe.split(secret).join('[REDACTED]');
  }
  return safe.slice(0, 1000);
}

export function sanitizeLogFields(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || value instanceof Error) return {};
  const fields: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!allowedFields.has(key)) continue;
    if (typeof entry === 'string') fields[key] = sanitizeLogText(entry).slice(0, 200);
    else if (typeof entry === 'number' && Number.isFinite(entry)) fields[key] = entry;
    else if (typeof entry === 'boolean') fields[key] = entry;
    else if (Array.isArray(entry))
      fields[key] = entry
        .slice(0, 5)
        .filter((item): item is string => typeof item === 'string')
        .map(sanitizeLogText);
  }
  return fields;
}
