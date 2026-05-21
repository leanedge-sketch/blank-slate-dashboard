import { parseProfileSections } from "../utils/profileText";

const SUBSECTION_TITLES = new Set([
  "rag documents",
  "crm interactions",
  "web search",
  "linkedin",
  "strategic-fit matrix",
  "strategic fit matrix",
  "score rationale",
  "key contacts",
  "key contacts for engagement",
  "interaction review",
  "interaction review (from crm)",
]);

function isSubsectionTitle(line: string): boolean {
  const t = line.trim().replace(/:$/, "").toLowerCase();
  return SUBSECTION_TITLES.has(t);
}

function splitBodyBlocks(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
}

function isBulletBlock(block: string): boolean {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.length > 0 && lines.every((l) => /^[-•]\s/.test(l));
}

function isNumberedBlock(block: string): boolean {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.length > 0 && lines.every((l) => /^\d+\.\s+/.test(l));
}

function renderBlock(block: string, key: string) {
  const lines = block.split("\n");
  const trimmedFirst = lines[0]?.trim() ?? "";

  if (lines.length === 1 && isSubsectionTitle(trimmedFirst)) {
    return (
      <h4
        key={key}
        style={{
          fontSize: "1.1rem",
          fontWeight: 700,
          color: "#1e40af",
          marginTop: "1.25rem",
          marginBottom: "0.75rem",
        }}
      >
        {trimmedFirst.replace(/:$/, "")}
      </h4>
    );
  }

  if (isBulletBlock(block)) {
    return (
      <ul
        key={key}
        style={{
          margin: "0 0 1.25rem 1.25rem",
          paddingLeft: "1rem",
          lineHeight: 1.85,
          color: "#374151",
        }}
      >
        {lines
          .map((l) => l.trim())
          .filter(Boolean)
          .map((line, i) => (
            <li key={i} style={{ marginBottom: "0.5rem" }}>
              {line.replace(/^[-•]\s+/, "")}
            </li>
          ))}
      </ul>
    );
  }

  if (isNumberedBlock(block)) {
    return (
      <ol
        key={key}
        style={{
          margin: "0 0 1.25rem 1.5rem",
          paddingLeft: "1rem",
          lineHeight: 1.85,
          color: "#374151",
        }}
      >
        {lines
          .map((l) => l.trim())
          .filter(Boolean)
          .map((line, i) => (
            <li key={i} style={{ marginBottom: "0.65rem" }}>
              {line.replace(/^\d+\.\s+/, "")}
            </li>
          ))}
      </ol>
    );
  }

  const parts: JSX.Element[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    if (text) {
      parts.push(
        <p
          key={`${key}-p-${parts.length}`}
          style={{
            marginBottom: "1.15rem",
            fontSize: "1rem",
            lineHeight: 1.85,
            color: "#374151",
          }}
        >
          {text}
        </p>
      );
    }
    paragraph = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      continue;
    }
    if (isSubsectionTitle(trimmed)) {
      flushParagraph();
      parts.push(
        <h4
          key={`${key}-sub-${parts.length}`}
          style={{
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "#1e40af",
            marginTop: parts.length ? "1.25rem" : 0,
            marginBottom: "0.75rem",
          }}
        >
          {trimmed.replace(/:$/, "")}
        </h4>
      );
      continue;
    }
    if (/^[-•]\s/.test(trimmed)) {
      flushParagraph();
      parts.push(
        <div
          key={`${key}-b-${parts.length}`}
          style={{
            marginLeft: "1rem",
            marginBottom: "0.65rem",
            paddingLeft: "1rem",
            borderLeft: "3px solid #10b981",
            lineHeight: 1.8,
            color: "#374151",
          }}
        >
          {trimmed.replace(/^[-•]\s+/, "")}
        </div>
      );
      continue;
    }
    if (/^(Name|Position|LinkedIn|Source|Email|Phone):/i.test(trimmed)) {
      flushParagraph();
      const colon = trimmed.indexOf(":");
      const label = trimmed.slice(0, colon + 1);
      const value = trimmed.slice(colon + 1).trim();
      parts.push(
        <div key={`${key}-c-${parts.length}`} style={{ marginBottom: "0.4rem", fontSize: "0.98rem" }}>
          <strong style={{ color: "#374151" }}>{label}</strong>{" "}
          <span style={{ color: "#4b5563" }}>{value}</span>
        </div>
      );
      continue;
    }
    paragraph.push(trimmed);
  }
  flushParagraph();

  return <div key={key}>{parts}</div>;
}

export function ProfileSections({ text }: { text: string }) {
  const sections = parseProfileSections(text);

  if (!sections.length) {
    return (
      <p style={{ color: "#6b7280", fontStyle: "italic" }}>No profile content to display.</p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {sections.map((section) => {
        if (!section.body.trim() && !section.title) return null;

        const heading =
          section.index >= 0
            ? `${section.index}. ${section.title}`
            : section.title || "Profile";

        return (
          <article
            key={`${section.index}-${section.title}`}
            style={{
              padding: "2rem",
              backgroundColor: "#ffffff",
              borderRadius: "1rem",
              border: "1px solid #e5e7eb",
              boxShadow:
                "0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04)",
            }}
          >
            <h3
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "#111827",
                marginBottom: "1.25rem",
                paddingBottom: "0.85rem",
                borderBottom: "3px solid #3b82f6",
              }}
            >
              {heading}
            </h3>
            {splitBodyBlocks(section.body).map((block, i) =>
              renderBlock(block, `${section.index}-${i}`)
            )}
          </article>
        );
      })}
    </div>
  );
}
