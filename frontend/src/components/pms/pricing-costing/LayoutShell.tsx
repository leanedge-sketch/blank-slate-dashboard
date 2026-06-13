import type { ReactNode } from "react";

type LayoutShellProps = {
  master: ReactNode;
  detail: ReactNode;
};

export function LayoutShell({ master, detail }: LayoutShellProps) {
  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {master}
      <section className="min-h-0 min-w-0 flex-1 bg-white">{detail}</section>
    </div>
  );
}
