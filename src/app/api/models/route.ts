import { OPENROUTER_MODELS_URL, MODELS_CACHE_TTL } from "@/lib/constants";

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
  top_provider?: {
    max_completion_tokens?: number;
  };
  architecture?: {
    modality: string;
    tokenizer: string;
    instruct_type: string;
  };
}

interface CachedModels {
  data: OpenRouterModel[];
  fetchedAt: number;
}

let modelsCache: CachedModels | null = null;

export async function GET() {
  try {
    // Return cached if fresh
    if (modelsCache && Date.now() - modelsCache.fetchedAt < MODELS_CACHE_TTL) {
      return Response.json(formatModels(modelsCache.data));
    }

    const res = await fetch(OPENROUTER_MODELS_URL, {
      headers: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      },
    });

    if (!res.ok) {
      throw new Error(`OpenRouter API returned ${res.status}`);
    }

    const { data } = await res.json();

    // Filter to chat models only and sort
    const chatModels = (data as OpenRouterModel[]).filter(
      (m) => m.architecture?.instruct_type || m.name
    );

    modelsCache = { data: chatModels, fetchedAt: Date.now() };

    return Response.json(formatModels(chatModels));
  } catch (error) {
    console.error("Fetch models error:", error);

    // Return cache even if stale on error
    if (modelsCache) {
      return Response.json(formatModels(modelsCache.data));
    }

    return Response.json({ error: "Failed to fetch models" }, { status: 500 });
  }
}

function formatModels(models: OpenRouterModel[]) {
  // Group by provider
  const grouped: Record<string, Array<{
    id: string;
    name: string;
    description?: string;
    contextLength: number;
    pricing: { prompt: number; completion: number };
    isFree: boolean;
  }>> = {};

  for (const model of models) {
    const [provider] = model.id.split("/");
    const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

    if (!grouped[providerName]) {
      grouped[providerName] = [];
    }

    const promptPrice = parseFloat(model.pricing.prompt) || 0;
    const completionPrice = parseFloat(model.pricing.completion) || 0;

    grouped[providerName].push({
      id: model.id,
      name: model.name,
      description: model.description,
      contextLength: model.context_length,
      pricing: {
        prompt: promptPrice,
        completion: completionPrice,
      },
      isFree: promptPrice === 0 && completionPrice === 0,
    });
  }

  // Sort providers: popular ones first
  const popularProviders = ["Anthropic", "Openai", "Google", "Meta", "Mistral", "Deepseek"];
  const sortedProviders = Object.keys(grouped).sort((a, b) => {
    const aIdx = popularProviders.indexOf(a);
    const bIdx = popularProviders.indexOf(b);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b);
  });

  return {
    providers: sortedProviders.map((name) => ({
      name,
      models: grouped[name].sort((a, b) => a.name.localeCompare(b.name)),
    })),
    total: models.length,
  };
}
