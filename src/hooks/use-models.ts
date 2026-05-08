"use client";

import { useState, useCallback, useEffect } from "react";
import { DEFAULT_MODEL } from "@/lib/constants";

export interface Model {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  pricing: { prompt: number; completion: number };
  isFree: boolean;
  supportsVision: boolean;
}

export interface CuratedModel extends Model {
  intelligenceLevel: number;
  costLevel: number;
  category: string | null;
}

interface Provider {
  name: string;
  models: Model[];
}

interface AllModelsData {
  providers: Provider[];
  total: number;
}

const STORAGE_KEY = "z1:last-model";

export function useModels() {
  const [curatedModels, setCuratedModels] = useState<CuratedModel[]>([]);
  const [allData, setAllData] = useState<AllModelsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [hasCurated, setHasCurated] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setSelectedModel(stored);
  }, []);

  const fetchCurated = useCallback(async () => {
    try {
      const res = await fetch("/api/models");
      if (res.ok) {
        const json = await res.json();
        if (json.hasCurated) {
          setCuratedModels(json.curated);
          setHasCurated(true);
          setTotal(json.total);
        } else {
          setAllData(json);
          setHasCurated(false);
          setTotal(json.total);
        }
      }
    } catch (error) {
      console.error("Failed to fetch models:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurated();
  }, [fetchCurated]);

  const expandAll = useCallback(async () => {
    setShowAll(true);
    if (!allData) {
      try {
        const res = await fetch("/api/models?all=true");
        if (res.ok) {
          const json = await res.json();
          setAllData(json);
        }
      } catch (error) {
        console.error("Failed to fetch all models:", error);
      }
    }
  }, [allData]);

  const collapseAll = useCallback(() => setShowAll(false), []);

  const selectModel = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem(STORAGE_KEY, modelId);
  }, []);

  const allModels = allData?.providers.flatMap((p) => p.models) || [];
  const currentModel =
    curatedModels.find((m) => m.id === selectedModel) ||
    allModels.find((m) => m.id === selectedModel);

  return {
    curatedModels,
    hasCurated,
    providers: allData?.providers || [],
    allModels,
    showAll,
    expandAll,
    collapseAll,
    selectedModel,
    selectModel,
    currentModel,
    isLoading,
    total,
  };
}
