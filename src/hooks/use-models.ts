"use client";

import { useState, useCallback, useEffect } from "react";
import { DEFAULT_MODEL } from "@/lib/constants";

interface Model {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  pricing: { prompt: number; completion: number };
  isFree: boolean;
  supportsVision: boolean;
}

interface Provider {
  name: string;
  models: Model[];
}

interface ModelsData {
  providers: Provider[];
  total: number;
}

const STORAGE_KEY = "one:last-model";

export function useModels() {
  const [data, setData] = useState<ModelsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);

  // Sync from localStorage after mount (avoids hydration mismatch)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setSelectedModel(stored);
  }, []);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch("/api/models");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("Failed to fetch models:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const selectModel = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem(STORAGE_KEY, modelId);
  }, []);

  // Flatten all models for search
  const allModels = data?.providers.flatMap((p) => p.models) || [];

  // Find current model info
  const currentModel = allModels.find((m) => m.id === selectedModel);

  return {
    providers: data?.providers || [],
    allModels,
    selectedModel,
    selectModel,
    currentModel,
    isLoading,
    total: data?.total || 0,
  };
}
