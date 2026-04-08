import { getCachedModels, type OpenRouterModel } from "@/lib/models-cache";

export async function GET() {
  try {
    const chatModels = await getCachedModels();
    return Response.json(formatModels(chatModels));
  } catch (error) {
    console.error("Fetch models error:", error);
    return Response.json({ error: "Failed to fetch models" }, { status: 500 });
  }
}

function formatModels(models: OpenRouterModel[]) {
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
