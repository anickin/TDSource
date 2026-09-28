import { describe, expect, it } from "vitest";
import { formatKnowledgeAnswer } from "./message-format";

describe("knowledge answer formatting", () => {
  it("turns headings, paragraphs, and lists into readable blocks", () => {
    expect(formatKnowledgeAnswer("## Summary\nUse the approved workflow.\n\nSteps:\n1. Open Settings\n2. Choose the team\n\n- Verify access\n- Save changes")).toEqual([
      { type: "heading", text: "Summary" },
      { type: "paragraph", text: "Use the approved workflow." },
      { type: "paragraph", text: "Steps:" },
      { type: "ordered-list", items: ["Open Settings", "Choose the team"] },
      { type: "unordered-list", items: ["Verify access", "Save changes"] },
    ]);
  });

  it("keeps adjacent prose readable when the provider omits blank lines", () => {
    expect(formatKnowledgeAnswer("First sentence.\nSecond sentence.")).toEqual([
      { type: "paragraph", text: "First sentence. Second sentence." },
    ]);
  });
});
