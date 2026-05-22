import { createAdminClient } from "./supabase/admin";
import { decrypt } from "./encryption";
import { getBotMode } from "./bot-mode";

const FALLBACK_NO_CONTEXT =
  "Halo! 🤖 Saya Alfredo, AI Companion Ijal. Data untuk pertanyaan itu belum tersedia di sistem saya. Silakan tanya tentang status server atau pipeline ya!";

const FALLBACK_ERROR_REPLY =
  "Maaf, terjadi gangguan. Silakan coba lagi dalam beberapa saat ya! 🤖";

const GREETING_PATTERNS = [
  /^halo$/i, /^hallo$/i, /^hai$/i, /^hey$/i, /^hi$/i, /^p$/i,
  /^assalamualaikum/i, /^walaikumsalam/i, /^salam$/i,
  /^selamat\s*(pagi|siang|sore|malam)/i,
  /^morning$/i, /^siang$/i, /^malam$/i,
  /^jal$/i, /^bro$/i, /^boss$/i, /^gan$/i, /^sob$/i,
  /^oi$/i, /^woi$/i, /^wey$/i, /^we$/i,
  /^cuy$/i, /^cuk$/i, /^coy$/i,
  /^hello$/i, /^yo$/i,
];

const INFRA_KEYWORDS = /\b(server|pipeline|deploy|status|app|error|down|up|build|release|staging|prod|dev|ci|cd|gitlab|docker|cpu|memory|disk|ping|config|log|job|cek|check|bagaimana|gimana|bagaimana|apa|kenapa|mengapa|kapan|dimana|berapa|tolong|bantu|help|masalah|problem|issue|trouble|fail|success|running|pending|online|offline)\b/i;

function isGreeting(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  const wordCount = trimmed.split(/\s+/).length
  if (wordCount > 4) return false
  if (INFRA_KEYWORDS.test(trimmed)) return false
  if (trimmed.length <= 2) return true
  return GREETING_PATTERNS.some(p => p.test(trimmed))
}

function getGreetingReply(): string {
  const tz = process.env.BOT_TIMEZONE || 'Asia/Jakarta'
  const now = new Date()
  const hourStr = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hour12: false }).format(now)
  const hour = parseInt(hourStr, 10)
  let salutation: string
  if (hour >= 3 && hour < 11) salutation = 'selamat pagi'
  else if (hour >= 11 && hour < 15) salutation = 'selamat siang'
  else if (hour >= 15 && hour < 18) salutation = 'selamat sore'
  else salutation = 'selamat malam'
  return `Halo, ${salutation}! 🤖 Saya Alfredo, AI Companion Ijal. Silakan tanya tentang status server atau pipeline ya!`
}

const PROVIDER_DEFAULTS: Record<
  string,
  { baseUrl: string; model: string; authHeader: string; authPrefix: string }
> = {
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1/chat/completions",
    model: "deepseek-chat",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
  },
  gemini: {
    baseUrl:
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.0-flash",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
  },
  ollama: {
    baseUrl: "https://ollama.com/api/chat",
    model: "deepseek-v4-flash",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
  },
};

interface LLMConfig {
  url: string;
  key: string;
  model: string;
  provider: string;
}

interface CachedConfig {
  config: LLMConfig;
  expiresAt: number;
}

let cachedConfig: CachedConfig | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

function getEnvConfig(): LLMConfig {
  const provider = process.env.AI_PROVIDER || "deepseek";
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.deepseek;
  const envKey =
    provider === "deepseek"
      ? process.env.DEEPSEEK_API_KEY
      : provider === "openai"
        ? process.env.OPENAI_API_KEY
        : provider === "gemini"
          ? process.env.GEMINI_API_KEY
          : provider === "ollama"
            ? process.env.OLLAMA_API_KEY
            : process.env.DEEPSEEK_API_KEY || "";

  return {
    provider,
    url: process.env.AI_BASE_URL || defaults.baseUrl,
    key: envKey || "",
    model: process.env.AI_MODEL || defaults.model,
  };
}

async function getDBConfig(): Promise<LLMConfig | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "ai_config")
      .single();

    if (error || !data) {
      console.error("[LLM] DB config fetch failed:", error?.message || "no data");
      return null;
    }

    const config = data.value as {
      provider?: string;
      temperature?: number;
      models?: Record<
        string,
        {
          apiKey?: string;
          model?: string;
          baseUrl?: string;
        }
      >;
    };

    const provider = config.provider || "deepseek";
    const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.deepseek;
    const modelConfig = config.models?.[provider];

    if (!modelConfig?.apiKey) {
      console.error(`[LLM] No API key in DB config for provider: ${provider}`);
      return null;
    }

    let apiKey: string;
    try {
      apiKey = decrypt(modelConfig.apiKey);
    } catch {
      console.error("[LLM] Decryption failed, using raw key (likely invalid)");
      apiKey = modelConfig.apiKey;
    }

    console.log(`[LLM] Using DB config: provider=${provider} model=${modelConfig.model || defaults.model} url=${modelConfig.baseUrl || defaults.baseUrl}`);

    return {
      provider,
      url: modelConfig.baseUrl || defaults.baseUrl,
      key: apiKey,
      model: modelConfig.model || defaults.model,
    };
  } catch (err) {
    console.error("[LLM] getDBConfig exception:", err);
    return null;
  }
}

async function getActiveConfig(): Promise<LLMConfig> {
  if (cachedConfig && Date.now() < cachedConfig.expiresAt) {
    return cachedConfig.config;
  }

  const dbConfig = await getDBConfig();
  const config = dbConfig || getEnvConfig();

  if (!dbConfig) {
    console.log(`[LLM] Using env config: provider=${config.provider} key=${config.key ? '***set***' : '***MISSING***'} model=${config.model}`);
  }

  cachedConfig = {
    config,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return config;
}

export function invalidateConfigCache() {
  cachedConfig = null;
}

function toWIB(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return isoString;
  }
}

function convertTimestampsToWIB(context: string): string {
  return context.replace(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g,
    (match) => toWIB(match),
  );
}

function detectAmbiguousProjects(context: string): string | null {
  const lines = context.split("\n");
  const repoGroups: Record<string, string[]> = {};

  for (const line of lines) {
    if (!line.startsWith("- Project:")) continue;
    const repoMatch = line.match(/Project:\s*(\S+)/);
    const groupMatch = line.match(/Group:\s*(\S+)/);
    if (!repoMatch || !groupMatch) continue;

    const repo = repoMatch[1];
    const group = groupMatch[1];
    if (group === "-") continue;

    if (!repoGroups[repo]) repoGroups[repo] = [];
    if (!repoGroups[repo].includes(group)) repoGroups[repo].push(group);
  }

  const ambiguous = Object.entries(repoGroups).filter(
    ([, groups]) => groups.length > 1,
  );
  if (ambiguous.length === 0) return null;

  const notes = ambiguous.map(([repo, groups]) => {
    const paths = groups.map((g) => `${g}/${repo}`).join(" dan ");
    return `Project "${repo}" ada di ${groups.length} group: ${paths}`;
  });

  return `[PERINGATAN AMBIGUITAS] ${notes.join(". ")} — WAJIB tanya untuk jelaskan project mana yang dimaksud sebelum jawab status!`;
}

function createSystemPrompt(context: string, activeStart = "03:00", activeEnd = "12:00"): string {
  const wibContext = convertTimestampsToWIB(context);

  let ambigNote = "";
  const ambig = detectAmbiguousProjects(wibContext);
  if (ambig) ambigNote = `\n\n${ambig}`;

  return `Kamu adalah Alfredo 🤖, DevOps AI Companion milik Ijal (DevOps Engineer).
Kamu membantu orang cek status server, pipeline, dan deployment.

Gaya bicara: santai tapi profesional. Sapaan "Halo". Jawab ringkas dan to-the-point.
Perkenalkan diri sebagai Alfredo di pesan pertama.
Jam aktif: ${activeStart}–${activeEnd} WIB. Di luar jam itu, Ijal lagi istirahat shift malam.

ATURAN MUTLAK (ZERO-HALLUCINATION):
1. HANYA jawab berdasarkan data konteks di bawah. Dilarang menebak atau mengarang.
2. Jika data tidak ada, jawab dengan fallback reply.

ATURAN AMBIGUITAS:
Jika dalam konteks ada lebih dari satu project dengan repo_name sama tapi project_group berbeda,
WAJIB tanya untuk jelaskan full repo path atau group-nya dulu sebelum jawab status.
Contoh: "Halo! 🤖 Ada 2 project 'dashboard' nih — wit-id/sub-group-a/dashboard dan wit-id/sub-group-b/dashboard. Maksudnya yang mana ya?"

ATURAN WAKTU:
Semua timestamp di konteks sudah dalam waktu WIB (Asia/Jakarta). Gunakan format WIB saat menjawab.

=== DATA DATABASE ===
${wibContext}
=== AKHIR DATA ===
${ambigNote}

CONTOH JAWABAN:
Server online → "Halo! 🤖 Alfredo di sini. Server app-prod-01 lagi online nih. Terakhir dicek 1 Jan 2026 10:00 WIB."

Pipeline failed → "Halo! 🤖 Pipeline dashboard gagal nih, error-nya module 'xyz' gak ketemu. Coba jalankan npm install xyz atau cek package.json-nya ya."

Sekarang jawab pertanyaan berdasarkan data di atas.`;
}

async function callOpenAICompatible(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
): Promise<{
  content: string | null;
  debug: { provider: string; status: number; error?: string };
}> {
  const debug = {
    provider: config.provider,
    status: 0,
    error: undefined as string | undefined,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.provider === "ollama") {
    if (config.key) {
      headers["Authorization"] = `Bearer ${config.key}`;
    }
  } else {
    headers["Authorization"] = `Bearer ${config.key}`;
  }

  const body =
    config.provider === "ollama"
      ? {
          model: config.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          stream: false,
        }
      : {
          model: config.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature: parseFloat(process.env.AI_TEMPERATURE || "0.0"),
          max_tokens: 512,
        };

  const response = await fetch(config.url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  debug.status = response.status;

  if (!response.ok) {
    const errorBody = await response.text();
    debug.error = errorBody.substring(0, 500);
    console.error(`[LLM] API error: provider=${config.provider} status=${response.status} body=${debug.error}`);
    return { content: null, debug };
  }

  const data = await response.json();

  if (config.provider === "ollama") {
    const content =
      data?.message?.content || data?.choices?.[0]?.message?.content;
    if (!content) {
      console.error(`[LLM] Empty ollama response:`, JSON.stringify(data).substring(0, 300));
    }
    return { content: content || null, debug };
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    console.error(`[LLM] Empty response: provider=${config.provider} model=${config.model}`, JSON.stringify(data).substring(0, 300));
  }
  return { content: content || null, debug };
}

export async function askAlfredo(
  context: string,
  userMessage: string,
): Promise<{
  reply: string;
  debug: {
    provider: string;
    hasContext: boolean;
    contextLength: number;
    status: number;
    error?: string;
  };
}> {
  const config = await getActiveConfig();
  const debug = {
    provider: config.provider,
    hasContext: !!context.trim(),
    contextLength: context.length,
    status: 0,
    error: undefined as string | undefined,
  };

  if (isGreeting(userMessage)) {
    return {
      reply: getGreetingReply(),
      debug: { ...debug, status: 0, error: "greeting_skip" },
    };
  }

  if (!context.trim()) {
    return {
      reply: FALLBACK_NO_CONTEXT,
      debug: { ...debug, status: 0, error: "empty_context" },
    };
  }

  if (!config.key) {
    console.error(
      `[LLM] No API key configured for provider: ${config.provider}`,
    );
    return {
      reply: FALLBACK_NO_CONTEXT,
      debug: { ...debug, status: 0, error: "no_api_key" },
    };
  }

  try {
    const { activeStart, activeEnd } = await getBotMode()
    const systemPrompt = createSystemPrompt(context, activeStart, activeEnd);
    const result = await callOpenAICompatible(
      config,
      systemPrompt,
      userMessage,
    );

    debug.status = result.debug.status;
    if (result.debug.error) debug.error = result.debug.error;

    if (!result.content) {
      debug.error = debug.error || "empty_llm_response";
      console.error("[LLM] Empty response from LLM");
    }

    return { reply:       result.content || FALLBACK_ERROR_REPLY, debug };
  } catch (err) {
    console.error("[LLM] Exception:", err);
    return { reply: FALLBACK_ERROR_REPLY, debug: { ...debug, error: String(err) } };
  }
}

export const SUPPORTED_PROVIDERS = Object.keys(PROVIDER_DEFAULTS);
