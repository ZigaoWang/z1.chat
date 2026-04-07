export interface Skill {
  id: string;
  name: string;
  triggers: {
    keywords: string[];
    patterns?: RegExp[];
  };
  prompt: string;
  priority: number; // lower = higher priority
}
