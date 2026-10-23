/** Server-side correction transport. No credentials or provider bodies reach the client. */
export type CorrectionProvider = 'groq' | 'google' | 'deepseek';
export type CorrectionConfig = {
  provider: CorrectionProvider;
  model: string;
  apiKey: string;
  maxRequestTokens: number;
  maxOutputTokens: number;
};

export class CorrectionProviderError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

function positiveInteger(value: string | undefined, fallback: number) {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new CorrectionProviderError('invalid_correction_config');
  return parsed;
}

export function correctionConfig(env: NodeJS.ProcessEnv = process.env): CorrectionConfig {
  // Preserve existing installations; never infer a provider from available keys.
  const provider = env.CORRECTION_PROVIDER?.trim() || 'deepseek';
  if (!['groq', 'google', 'deepseek'].includes(provider))
    throw new CorrectionProviderError('invalid_correction_provider');
  const prefix = provider.toUpperCase();
  const apiKey = env[`${prefix}_API_KEY`]?.trim();
  if (!apiKey) throw new CorrectionProviderError('missing_correction_key');
  const defaults = {
    groq: env.LLM_MODEL || 'openai/gpt-oss-20b',
    google: env.GOOGLE_LLM_MODEL || 'gemini-3-flash-preview',
    deepseek: env.DEEPSEEK_LLM_MODEL || 'deepseek-flash',
  };
  const model = (env.CORRECTION_MODEL || defaults[provider as CorrectionProvider]).trim();
  if (!model) throw new CorrectionProviderError('invalid_correction_config');
  const maxRequestTokens = positiveInteger(
    env.CORRECTION_MAX_REQUEST_TOKENS,
    provider === 'groq' ? 6500 : 32000
  );
  const maxOutputTokens = positiveInteger(env.CORRECTION_MAX_COMPLETION_TOKENS, 1400);
  if (maxOutputTokens >= maxRequestTokens)
    throw new CorrectionProviderError('invalid_correction_config');
  return {
    provider: provider as CorrectionProvider,
    model,
    apiKey,
    maxRequestTokens,
    maxOutputTokens,
  };
}

export async function requestCorrection(
  config: CorrectionConfig,
  system: string,
  user: string
): Promise<unknown> {
  // Conservative local guard, not an exact provider tokenizer or a monetary cap.
  // Never silently truncate learner evidence to fit another provider.
  const estimate = Math.ceil((system.length + user.length) / 3) + config.maxOutputTokens + 128;
  if (estimate > config.maxRequestTokens)
    throw new CorrectionProviderError('correction_request_too_large');
  const google = config.provider === 'google';
  const url = google
    ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model.replace(/^models\//, ''))}:generateContent`
    : config.provider === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.deepseek.com/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: google
      ? { 'x-goog-api-key': config.apiKey, 'Content-Type': 'application/json' }
      : { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify(
      google
        ? {
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              maxOutputTokens: config.maxOutputTokens,
              temperature: 0.2,
            },
          }
        : {
            model: config.model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            max_tokens: config.maxOutputTokens,
            temperature: 0.2,
            stream: false,
            response_format: { type: 'json_object' },
            ...(config.provider === 'deepseek' ? { thinking: { type: 'disabled' } } : {}),
            ...(config.provider === 'groq' && config.model.startsWith('openai/gpt-oss')
              ? { reasoning_effort: 'low' }
              : {}),
          }
    ),
  });
  if (!response.ok) throw new CorrectionProviderError(`${config.provider} HTTP ${response.status}`);
  const data = await response.json();
  const candidate = google ? data.candidates?.[0] : data.choices?.[0];
  const finish = google ? candidate?.finishReason : candidate?.finish_reason;
  if (finish && finish !== (google ? 'STOP' : 'stop'))
    throw new CorrectionProviderError('incomplete_correction_response');
  const text = google
    ? candidate?.content?.parts
        ?.filter((part: { thought?: boolean; text?: string }) => !part.thought)
        .map((part: { text?: string }) => part.text || '')
        .join('')
    : candidate?.message?.content;
  if (typeof text !== 'string' || !text.trim())
    throw new CorrectionProviderError('invalid_correction_response');
  return JSON.parse(text);
}
