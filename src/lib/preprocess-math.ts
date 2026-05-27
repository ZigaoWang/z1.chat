const DOLLAR_PLACEHOLDER = "＄";

export function preprocessMath(text: string): string {
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `$$${m}$$`);
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => `$${m}$`);

  let result = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === "`") {
      if (text[i + 1] === "`" && text[i + 2] === "`") {
        const end = text.indexOf("```", i + 3);
        const stop = end !== -1 ? end + 3 : text.length;
        result += text.slice(i, stop);
        i = stop;
        continue;
      }
      const end = text.indexOf("`", i + 1);
      const stop = end !== -1 ? end + 1 : text.length;
      result += text.slice(i, stop);
      i = stop;
      continue;
    }

    if (text[i] === "$" && text[i + 1] === "$") {
      const start = i + 2;
      let j = start;
      while (j < text.length - 1) {
        if (text[j] === "$" && text[j + 1] === "$") break;
        j++;
      }
      result += "$$" + text.slice(start, j).replace(/\\\$/g, DOLLAR_PLACEHOLDER) + "$$";
      i = j + 2;
      continue;
    }

    if (text[i] === "$") {
      const next = text[i + 1];
      if (!next || next === " " || next === "\n") { result += text[i++]; continue; }

      let j = i + 1, content = "", closed = false;
      while (j < text.length) {
        if (text[j] === "\\" && text[j + 1] === "$") { content += DOLLAR_PLACEHOLDER; j += 2; continue; }
        if (text[j] === "$" && text[j - 1] !== " ") { closed = true; break; }
        if (text[j] === "\n" && text[j + 1] === "\n") break;
        content += text[j++];
      }

      if (closed) { result += "$" + content + "$"; i = j + 1; continue; }
      if (/\d/.test(next)) { result += "\\$"; i++; continue; }
      result += text[i++];
      continue;
    }

    result += text[i++];
  }
  return result;
}
