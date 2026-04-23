/**
 * AI Codesets — three different provider strategies that can be toggled
 * from the admin panel at runtime (no code change / redeploy needed).
 *
 * The aiProvider wrapper reads the active codeset and routes each prompt
 * to Claude or OpenAI with the right temperature, system rules, and
 * response-format settings.
 *
 * promptKeys used by the router map to the existing DB prompt keys:
 *   authorDNA → ai:dna_author
 *   storyDNA  → ai:dna_story
 *   pass1     → ai:review_pass1
 *   pass2     → ai:review_pass2
 *   pass3     → ai:review_pass3
 *   pass4     → ai:review_pass4
 *   validate  → ai:review_validate (cheap Haiku/GPT-mini)
 *   develop   → ai:develop_* (brainstorm, expand, rewrite, newscene)
 *   translate → ai:translate
 *   finalCheck → ai:final_check
 */

// Shared rules that get injected into every system prompt regardless of provider
const SHARED_SYSTEM_RULES = [
  'Return ONLY valid JSON.',
  'No markdown wrappers around JSON.',
  'No explanations outside JSON.',
  "If uncertain return 'unknown'.",
  'Follow Observation → Effect on reader → Actionable rule or fix.',
];

// Default model names per provider
const MODELS = {
  claude: {
    default: 'claude-sonnet-4-20250514',
    cheap: 'claude-haiku-4-5-20251001',
  },
  openai: {
    default: 'gpt-4o',
    cheap: 'gpt-4o-mini',
  },
};

/** Temperature per task — used when codeset doesn't override */
const DEFAULT_TEMPERATURE = {
  authorDNA: 0.2,
  storyDNA: 0.2,
  pass1: 0.1,
  pass2: 0.1,
  pass3: 0.3,
  pass4: 0.3,
  validate: 0.1,
  develop: 0.7,
  translate: 0.3,
  finalCheck: 0.2,
};

// ═══════════════════════════════════════════════════════════════════════
// CODESET 1: CLAUDE ONLY
// ═══════════════════════════════════════════════════════════════════════
export const CODESET_CLAUDE_ONLY = {
  id: 'claude-only',
  name: 'Claude (allt)',
  description: 'Alla anrop går till Claude. Bäst för stabil reasoning och instruktionsföljsamhet.',
  strategy: 'single-provider',
  defaultProvider: 'claude',
  routing: {
    authorDNA: 'claude',
    storyDNA: 'claude',
    pass1: 'claude',
    pass2: 'claude',
    pass3: 'claude',
    pass4: 'claude',
    validate: 'claude',
    develop: 'claude',
    translate: 'claude',
    finalCheck: 'claude',
  },
  temperature: DEFAULT_TEMPERATURE,
  systemRules: [
    ...SHARED_SYSTEM_RULES,
    'Follow instructions exactly.',
    'Do not infer beyond the text.',
  ],
  parsing: {
    strictJSON: true,
    fallbackExtraction: false,
  },
  fallbacks: {
    ifClaudeFails: 'retryOnce',
  },
  validation: {
    jsonSchemaValidation: true,
    retryOnInvalidJSON: true,
  },
  strengths: [
    'High instruction adherence',
    'Stable JSON output',
    'Strong reasoning',
  ],
  weaknesses: [
    'Less strict schema enforcement',
    'Can over-explain if not constrained',
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// CODESET 2: OPENAI ONLY
// ═══════════════════════════════════════════════════════════════════════
export const CODESET_OPENAI_ONLY = {
  id: 'openai-only',
  name: 'OpenAI (allt)',
  description: 'Alla anrop går till OpenAI (GPT-4o). Bäst för strikt strukturerad output och precis grammatikdetektion.',
  strategy: 'single-provider',
  defaultProvider: 'openai',
  routing: {
    authorDNA: 'openai',
    storyDNA: 'openai',
    pass1: 'openai',
    pass2: 'openai',
    pass3: 'openai',
    pass4: 'openai',
    validate: 'openai',
    develop: 'openai',
    translate: 'openai',
    finalCheck: 'openai',
  },
  temperature: {
    ...DEFAULT_TEMPERATURE,
    authorDNA: 0.2,
    storyDNA: 0.2,
    pass1: 0.1,
    pass2: 0.1,
  },
  systemRules: [
    ...SHARED_SYSTEM_RULES,
    'Be deterministic.',
    'Avoid vague language.',
  ],
  apiSettings: {
    response_format: { type: 'json_object' },
  },
  parsing: {
    strictJSON: true,
    fallbackExtraction: true, // markdown-block fallback if JSON mode fails
  },
  tokenHandling: {
    maxContext: 120000,
    requiresChunking: true,
  },
  promptHints: {
    authorDNA: {
      requiresFewShot: true,
      extraConstraints: [
        'Use explicit rules',
        'Avoid interpretation without evidence',
      ],
    },
    storyDNA: {
      extraConstraints: [
        'Define scene rules explicitly',
        'Define conflict progression',
      ],
    },
    pass1: { strictness: 'high', confidenceThreshold: 0.85 },
    pass2: { focus: ['logic errors', 'pronoun errors'] },
    pass3: { requiresEffectExplanation: true },
    pass4: { requiresStructuredDiagnosis: true },
  },
  fallbacks: {
    ifOpenAIFails: 'retryWithLowerTemperature',
  },
  strengths: [
    'Strong schema adherence',
    'Good at structured output',
  ],
  weaknesses: [
    'Needs JSON mode',
    'More variable outputs',
    'Needs stronger constraints',
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// CODESET 3: DUAL PROVIDER (split)
// ═══════════════════════════════════════════════════════════════════════
export const CODESET_DUAL_PROVIDER = {
  id: 'dual-provider',
  name: 'Dual (Claude + OpenAI)',
  description:
    'Splittar uppdraget: Claude för reasoning-tunga uppgifter (DNA, pass3-4), OpenAI för strukturerade (pass1-2). Optimerar både kostnad och kvalitet.',
  strategy: 'dual-provider',
  defaultProvider: 'claude',
  routing: {
    authorDNA: 'claude',
    storyDNA: 'claude',
    pass1: 'openai',
    pass2: 'openai',
    pass3: 'claude',
    pass4: 'claude',
    validate: 'claude', // haiku — fast + cheap
    develop: 'claude', // creative reasoning
    translate: 'claude', // nuance
    finalCheck: 'claude', // holistic reasoning
  },
  temperature: {
    authorDNA: 0.2,
    storyDNA: 0.2,
    pass1: 0.1, // openai
    pass2: 0.1, // openai
    pass3: 0.3, // claude
    pass4: 0.3, // claude
    validate: 0.1,
    develop: 0.7,
    translate: 0.3,
    finalCheck: 0.2,
  },
  systemRules: SHARED_SYSTEM_RULES,
  apiSettings: {
    openai: { response_format: { type: 'json_object' } },
  },
  parsing: {
    claude: { strict: true },
    openai: { strict: true, fallbackExtraction: true },
  },
  fallbacks: {
    ifClaudeFails: 'retryOnce',
    ifOpenAIFails: 'retryWithLowerTemperature',
  },
  validation: {
    jsonSchemaValidation: true,
    retryOnInvalidJSON: true,
  },
  pipeline: [
    'authorDNA (Claude, cached 30d)',
    'storyDNA (Claude, cached)',
    'pass1 (OpenAI)',
    'pass2 (OpenAI)',
    'pass3 (Claude)',
    'pass4 (Claude)',
  ],
  performance: {
    costOptimization: 'Use OpenAI for high-volume tasks',
    qualityOptimization: 'Use Claude for reasoning-heavy tasks',
  },
  reasoning: {
    claude: [
      'Better narrative understanding',
      'More stable reasoning',
      'Stronger editorial analysis',
    ],
    openai: [
      'Better structured output',
      'More precise grammar detection',
      'Scales cheaper',
    ],
  },
};

export const CODESETS = {
  'claude-only': CODESET_CLAUDE_ONLY,
  'openai-only': CODESET_OPENAI_ONLY,
  'dual-provider': CODESET_DUAL_PROVIDER,
};

export { MODELS, SHARED_SYSTEM_RULES };

/**
 * Resolve provider + settings for a given promptKey within a codeset.
 * Returns { provider, model, temperature, systemRules, responseFormat, parsing }
 */
export function resolveCall(codeset, promptKey, { cheap = false } = {}) {
  const cs = codeset || CODESET_CLAUDE_ONLY;
  const provider = cs.routing?.[promptKey] || cs.defaultProvider || 'claude';
  const modelSet = MODELS[provider] || MODELS.claude;
  const model = cheap ? modelSet.cheap : modelSet.default;
  const temperature =
    cs.temperature?.[promptKey] ?? DEFAULT_TEMPERATURE[promptKey] ?? 0.3;

  // Response format: OpenAI supports json_object mode
  let responseFormat = null;
  if (provider === 'openai') {
    responseFormat =
      cs.apiSettings?.response_format ||
      cs.apiSettings?.openai?.response_format ||
      { type: 'json_object' };
  }

  // Parsing strictness
  let parsing = { strictJSON: true, fallbackExtraction: false };
  if (cs.parsing) {
    if (cs.parsing[provider]) {
      parsing = { ...parsing, ...cs.parsing[provider] };
    } else {
      parsing = { ...parsing, ...cs.parsing };
    }
  }
  // OpenAI always needs fallback extraction safety net
  if (provider === 'openai') parsing.fallbackExtraction = true;

  return {
    provider,
    model,
    temperature,
    systemRules: cs.systemRules || SHARED_SYSTEM_RULES,
    responseFormat,
    parsing,
    promptHints: cs.promptHints?.[promptKey] || null,
    fallbacks: cs.fallbacks || {},
  };
}
