import React from "react";

/**
 * Minimal markdown-ish renderer:
 *  **bold**  -> <strong>
 *  *italic*  -> <em>
 *  __underline__ -> <u>
 *  Newlines preserved.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*)/g;
  const lines = text.split("\n");
  lines.forEach((line, li) => {
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    const lineRegex = new RegExp(regex.source, "g");
    while ((match = lineRegex.exec(line)) !== null) {
      if (match.index > lastIdx) parts.push(line.slice(lastIdx, match.index));
      const token = match[0];
      if (token.startsWith("**")) parts.push(<strong key={`b-${li}-${match.index}`} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>);
      else if (token.startsWith("__")) parts.push(<u key={`u-${li}-${match.index}`}>{token.slice(2, -2)}</u>);
      else parts.push(<em key={`i-${li}-${match.index}`}>{token.slice(1, -1)}</em>);
      lastIdx = match.index + token.length;
    }
    if (lastIdx < line.length) parts.push(line.slice(lastIdx));
    if (li < lines.length - 1) parts.push(<br key={`br-${li}`} />);
  });
  return <span className={className}>{parts}</span>;
}