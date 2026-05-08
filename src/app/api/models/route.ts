import { getCachedModels, type OpenRouterModel } from "@/lib/models-cache";
import { db } from "@/lib/db";
import { curatedModels } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const showAll = url.searchParams.get("all") === "true";
    const chatModels = await getCachedModels();

    if (showAll) {
      return Response.json(formatModels(chatModels));
    }

    const curated = await db
      .select()
      .from(curatedModels)
      .where(eq(curatedModels.enabled, true))
      .orderBy(asc(curatedModels.sortOrder));

    if (curated.length === 0) {
      return Response.json({ ...formatModels(chatModels), hasCurated: false });
    }

    const curatedResult = curated
      .map((cm) => {
        const live = chatModels.find((m) => m.id === cm.modelId);
        if (!live) return null;
        const promptPrice = parseFloat(live.pricing.prompt) || 0;
        const completionPrice = parseFloat(live.pricing.completion) || 0;
        return {
          id: live.id,
          name: cm.displayName || live.name,
          contextLength: live.context_length,
          pricing: { prompt: promptPrice, completion: completionPrice },
          isFree: promptPrice === 0 && completionPrice === 0,
          supportsVision: (live.architecture?.input_modalities || []).includes("image"),
          intelligenceLevel: cm.intelligenceLevel,
          costLevel: cm.costLevel,
          category: cm.category,
        };
      })
      .filter(Boolean);

    return Response.json({
      curated: curatedResult,
      total: chatModels.length,
      hasCurated: true,
    });
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
    supportsVision: boolean;
  }>> = {};

  for (const model of models) {
    const [provider] = model.id.split("/");
    const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

    if (!grouped[providerName]) {
      grouped[providerName] = [];
    }

    const promptPrice = parseFloat(model.pricing.prompt) || 0;
    const completionPrice = parseFloat(model.pricing.completion) || 0;
    const inputModalities = model.architecture?.input_modalities || [];

    grouped[providerName].push({
      id: model.id,
      name: model.name,
      description: model.description,
      contextLength: model.context_length,
      pricing: { prompt: promptPrice, completion: completionPrice },
      isFree: promptPrice === 0 && completionPrice === 0,
      supportsVision: inputModalities.includes("image"),
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
