/**
 * INV-7: document content is data, never instruction. Verbatim snippets, rationales,
 * and any other document- or model-derived text render through this component only —
 * as an escaped text node, never as markdown or HTML. `dangerouslySetInnerHTML` is
 * banned repo-wide by ESLint (`react/no-danger`); this component is the positive
 * pattern that replaces the temptation to reach for it.
 */
export function SnippetText({ text, className }: { text: string; className?: string }) {
  return <span className={className}>{text}</span>;
}
