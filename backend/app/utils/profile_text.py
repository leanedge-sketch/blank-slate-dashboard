"""
Normalize AI-generated customer profiles to plain text (no markdown tables/headers).
"""
from __future__ import annotations

import re


def sanitize_profile_plain_text(text: str) -> str:
    """
    Strip markdown artifacts so the CRM UI shows bullets and numbered sections,
    not raw | tables | or ### headers.
    """
    if not text or not text.strip():
        return ""

    out = text.strip()

    # Remove fenced JSON / code blocks
    out = re.sub(r"```json[\s\S]*?```", "", out, flags=re.IGNORECASE)
    out = re.sub(r"```[\s\S]*?```", "", out)
    out = re.sub(
        r"\{[^{}]*\"strategic_fit_matrix\"[^{}]*\{[^{}]*\}[^{}]*\}",
        "",
        out,
        flags=re.IGNORECASE | re.DOTALL,
    )
    out = re.sub(
        r"\{[^}]*\"strategic_fit_matrix\"[^}]*\}",
        "",
        out,
        flags=re.IGNORECASE | re.DOTALL,
    )

    # Line-by-line: drop table separator rows and pipe-only lines
    cleaned_lines: list[str] = []
    for line in out.splitlines():
        stripped = line.strip()
        if not stripped:
            cleaned_lines.append("")
            continue
        if _is_markdown_table_separator_line(stripped):
            continue
        if _is_markdown_table_row(stripped):
            converted = _table_row_to_plain(stripped)
            if converted:
                cleaned_lines.append(converted)
            continue
        # Markdown headings -> plain title line
        heading = re.match(r"^#{1,6}\s+(.+)$", stripped)
        if heading:
            title = heading.group(1).strip()
            cleaned_lines.append("")
            cleaned_lines.append(title)
            cleaned_lines.append("")
            continue
        cleaned_lines.append(line)

    out = "\n".join(cleaned_lines)

    # Inline markdown
    out = re.sub(r"\*\*([^*]+)\*\*", r"\1", out)
    out = re.sub(r"\*([^*]+)\*", r"\1", out)
    out = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1 (\2)", out)
    out = re.sub(r"\[(\d+)\]", "", out)

    # Collapse excessive blank lines
    out = re.sub(r"\n{3,}", "\n\n", out)

    return out.strip()


def _is_markdown_table_separator_line(line: str) -> bool:
    """e.g. |:---|:---| or | --- | --- |"""
    if "|" not in line:
        return False
    cells = [c.strip() for c in line.strip("|").split("|")]
    if not cells:
        return False
    return all(re.match(r"^:?-{2,}:?$", c) or c == "" for c in cells)


def _is_markdown_table_row(line: str) -> bool:
    s = line.strip()
    return s.startswith("|") and s.endswith("|") and s.count("|") >= 2


def _table_row_to_plain(line: str) -> str:
    """Convert | A | B | to 'A: B' or bullet list."""
    cells = [c.strip() for c in line.strip("|").split("|") if c.strip()]
    cells = [c for c in cells if not re.match(r"^:?-{2,}:?$", c)]
    if not cells:
        return ""
    if len(cells) == 1:
        return f"- {cells[0]}"
    if len(cells) == 2:
        return f"- {cells[0]}: {cells[1]}"
    return "- " + " • ".join(cells)
