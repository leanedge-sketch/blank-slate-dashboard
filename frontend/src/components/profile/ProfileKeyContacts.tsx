import { ExternalLink, User } from "lucide-react";
import type { ProfileContact } from "../../utils/profileText";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProfileKeyContacts({ contacts }: { contacts: ProfileContact[] }) {
  if (!contacts.length) {
    return (
      <p className="text-sm text-slate-500 italic m-0">
        No key contacts parsed from this profile. Regenerate ICP or add contacts in section 4.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {contacts.map((c, i) => (
        <article
          key={`${c.name}-${i}`}
          className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white"
            aria-hidden
          >
            {initials(c.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-base font-semibold text-slate-900 truncate m-0">{c.name}</h4>
            {c.position ? (
              <p className="text-sm text-slate-600 mt-0.5 mb-2 line-clamp-2">{c.position}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {c.linkedin ? (
                <a
                  href={c.linkedin.startsWith("http") ? c.linkedin : `https://${c.linkedin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  <ExternalLink size={12} />
                  LinkedIn
                </a>
              ) : null}
              {c.source ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  <User size={12} />
                  {c.source}
                </span>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
