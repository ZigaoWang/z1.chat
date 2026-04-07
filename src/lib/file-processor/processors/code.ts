import type { ProcessedFile } from "../types";
import { MAX_TEXT_PER_FILE } from "@/lib/constants";

const LANGUAGE_MAP: Record<string, string> = {
  js: "JavaScript",
  ts: "TypeScript",
  jsx: "JSX",
  tsx: "TSX",
  py: "Python",
  rb: "Ruby",
  go: "Go",
  rs: "Rust",
  java: "Java",
  c: "C",
  cpp: "C++",
  h: "C Header",
  hpp: "C++ Header",
  cs: "C#",
  swift: "Swift",
  kt: "Kotlin",
  php: "PHP",
  lua: "Lua",
  r: "R",
  dart: "Dart",
  vue: "Vue",
  svelte: "Svelte",
  astro: "Astro",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  sass: "Sass",
  less: "Less",
  sql: "SQL",
  sh: "Shell",
  bash: "Bash",
  zsh: "Zsh",
  graphql: "GraphQL",
  proto: "Protocol Buffers",
  dockerfile: "Dockerfile",
  makefile: "Makefile",
  env: "Environment",
  ini: "INI",
  cfg: "Config",
  conf: "Config",
};

export async function processCode(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<ProcessedFile> {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  // For files without extension, use the full filename (e.g. Dockerfile, Makefile)
  const baseName = filename.split("/").pop()?.toLowerCase() || "";
  const language = LANGUAGE_MAP[ext] || LANGUAGE_MAP[baseName] || ext.toUpperCase();

  let textContent = buffer.toString("utf-8");
  let truncated = false;

  if (textContent.length > MAX_TEXT_PER_FILE) {
    textContent = textContent.slice(0, MAX_TEXT_PER_FILE);
    truncated = true;
  }

  const header = `Language: ${language}\nFile: ${filename}`;
  textContent = `${header}\n\n${textContent}`;
  if (truncated) {
    textContent += "\n\n[Content truncated due to length]";
  }

  return {
    fileType: "code",
    originalName: filename,
    mimeType,
    size: buffer.length,
    textContent,
    truncated,
    display: { icon: "code", label: language },
  };
}
