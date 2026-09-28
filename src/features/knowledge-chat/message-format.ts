export type KnowledgeAnswerBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] };

const headingPattern = /^#{1,3}\s+(.+)$/;
const unorderedPattern = /^[-*•]\s+(.+)$/;
const orderedPattern = /^\d+[.)]\s+(.+)$/;

export function formatKnowledgeAnswer(value: string): KnowledgeAnswerBlock[] {
  const blocks: KnowledgeAnswerBlock[] = [];
  let paragraph: string[] = [];
  let list: { type: "unordered-list" | "ordered-list"; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  const flushList = () => {
    if (list?.items.length) blocks.push(list);
    list = null;
  };

  for (const rawLine of value.replaceAll("\r\n", "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) { flushParagraph(); flushList(); continue; }
    const heading = line.match(headingPattern);
    const unordered = line.match(unorderedPattern);
    const ordered = line.match(orderedPattern);
    if (heading) { flushParagraph(); flushList(); blocks.push({ type: "heading", text: heading[1] }); continue; }
    if (unordered || ordered) {
      flushParagraph();
      const type = unordered ? "unordered-list" : "ordered-list";
      const activeList = list as { type: "unordered-list" | "ordered-list"; items: string[] } | null;
      if (!activeList || activeList.type !== type) { flushList(); list = { type, items: [] }; }
      (list as { type: "unordered-list" | "ordered-list"; items: string[] }).items.push((unordered || ordered)![1]);
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph(); flushList();
  return blocks;
}
