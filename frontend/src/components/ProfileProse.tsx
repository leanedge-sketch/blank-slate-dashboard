import type { ReactNode } from "react";

/**
 * Readable prose renderer for long plain-text / light-markdown ICP content.
 */

const SUBSECTION_TITLES = new Set([
  "rag documents",
  "crm interactions",
  "crm history",
  "web search",
  "linkedin",
  "strategic-fit matrix",
  "strategic fit matrix",
  "score rationale",
  "key contacts",
  "key contacts for engagement",
  "interaction review",
  "interaction review (from crm)",
  "strategic actions",
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

function inlineFormat(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={m.index}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      parts.push(<em key={m.index}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`")) {
      parts.push(
        <code
          key={m.index}
          style={{
            fontSize: "0.9em",
            backgroundColor: "#f3f4f6",
            padding: "0.1em 0.35em",
            borderRadius: "0.25rem",
          }}
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (m[2] && m[3]) {
      parts.push(
        <a key={m.index} href={m[3]} target="_blank" rel="noopener noreferrer">
          {m[2]}
        </a>,
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
}

function renderBlock(block: string, key: string, compact?: boolean) {
  const lines = block.split("\n");
  const trimmedFirst = lines[0]?.trim() ?? "";

  if (lines.length === 1 && isSubsectionTitle(trimmedFirst)) {
    return (
      <h4
        key={key}
        className="profile-prose-subheading"
        style={{
          fontSize: compact ? "1rem" : "1.1rem",
          fontWeight: 700,
          color: "#1e40af",
          marginTop: compact ? "1rem" : "1.25rem",
          marginBottom: "0.65rem",
        }}
      >
        {trimmedFirst.replace(/:$/, "")}
      </h4>
    );
  }

  const allBullets = lines.every((l) => !l.trim() || /^[-•]\s/.test(l.trim()));
  if (allBullets && lines.some((l) => l.trim())) {
    return (
      <ul
        key={key}
        style={{
          margin: "0 0 1rem 1.1rem",
          paddingLeft: "1rem",
          lineHeight: 1.8,
          fontSize: compact ? "0.9375rem" : "1rem",
        }}
      >
        {lines
          .map((l) => l.trim())
          .filter(Boolean)
          .map((line, i) => (
            <li key={i} style={{ marginBottom: "0.45rem" }}>
              {inlineFormat(line.replace(/^[-•]\s+/, ""))}
            </li>
          ))}
      </ul>
    );
  }

  const allNumbered = lines.every((l) => !l.trim() || /^\d+\.\s+/.test(l.trim()));
  if (allNumbered && lines.some((l) => l.trim())) {
    return (
      <ol
        key={key}
        style={{
          margin: "0 0 1rem 1.25rem",
          paddingLeft: "1rem",
          lineHeight: 1.8,
          fontSize: compact ? "0.9375rem" : "1rem",
        }}
      >
        {lines
          .map((l) => l.trim())
          .filter(Boolean)
          .map((line, i) => (
            <li key={i} style={{ marginBottom: "0.5rem" }}>
              {inlineFormat(line.replace(/^\d+\.\s+/, ""))}
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
            marginBottom: compact ? "0.9rem" : "1.1rem",
            fontSize: compact ? "0.9375rem" : "1.02rem",
            lineHeight: 1.85,
            color: "#374151",
          }}
        >
          {inlineFormat(text)}
        </p>,
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
          className="profile-prose-subheading"
          style={{
            fontSize: compact ? "1rem" : "1.1rem",
            fontWeight: 700,
            color: "#1e40af",
            marginTop: parts.length ? "1rem" : 0,
            marginBottom: "0.65rem",
          }}
        >
          {trimmed.replace(/:$/, "")}
        </h4>,
      );
      continue;
    }
    if (/^#{1,6}\s+/.test(trimmed)) {
      flushParagraph();
      parts.push(
        <h4
          key={`${key}-h-${parts.length}`}
          style={{
            fontSize: compact ? "1.05rem" : "1.15rem",
            fontWeight: 700,
            color: "#111827",
            marginBottom: "0.5rem",
          }}
        >
          {trimmed.replace(/^#{1,6}\s+/, "")}
        </h4>,
      );
      continue;
    }
    if (/^[-•]\s/.test(trimmed)) {
      flushParagraph();
      parts.push(
        <div
          key={`${key}-b-${parts.length}`}
          style={{
            marginLeft: "0.75rem",
            marginBottom: "0.55rem",
            paddingLeft: "1rem",
            borderLeft: "3px solid #10b981",
            lineHeight: 1.8,
            fontSize: compact ? "0.9375rem" : "1rem",
          }}
        >
          {inlineFormat(trimmed.replace(/^[-•]\s+/, ""))}
        </div>,
      );
      continue;
    }
    if (/^(Name|Position|LinkedIn|Source|Email|Phone):/i.test(trimmed)) {
      flushParagraph();
      const colon = trimmed.indexOf(":");
      const label = trimmed.slice(0, colon + 1);
      const value = trimmed.slice(colon + 1).trim();
      parts.push(
        <div
          key={`${key}-c-${parts.length}`}
          style={{ marginBottom: "0.35rem", fontSize: compact ? "0.9rem" : "0.98rem" }}
        >
          <strong>{label}</strong> <span style={{ color: "#4b5563" }}>{inlineFormat(value)}</span>
        </div>,
      );
      continue;
    }
    paragraph.push(trimmed);
  }
  flushParagraph();

  return <div key={key}>{parts}</div>;
}

export function ProfileProse({
  body,
  compact = false,
  hero = false,
}: {
  body: string;
  compact?: boolean;
  hero?: boolean;
}) {
  if (!body?.trim()) {
    return (
      <p style={{ color: "#9ca3af", fontStyle: "italic", margin: 0 }}>
        No content available for this section.
      </p>
    );
  }

  return (
    <div
      className={hero ? "profile-prose-hero" : undefined}
      style={{
        lineHeight: hero ? 1.9 : 1.85,
        color: "#374151",
        fontSize: hero ? "1.0625rem" : undefined,
      }}
    >
      {splitBodyBlocks(body).map((block, i) => renderBlock(block, `block-${i}`, compact))}
    </div>
  );
}
