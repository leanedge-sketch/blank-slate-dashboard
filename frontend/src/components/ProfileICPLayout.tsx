import { parseICPProfile, stripStrategicFitLinesFromProfile } from "../utils/profileText";
import type { ProfileResearchMeta } from "./ProfileResearchContext";
import { ProfileDeepDiveTabs } from "./ProfileDeepDiveTabs";
import { ProfileProse } from "./ProfileProse";
import { StrategicFitAssessment } from "./StrategicFitAssessment";
import type { StrategicFitItem } from "../utils/profileText";

function SectionCard({
  title,
  subtitle,
  children,
  variant = "default",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  variant?: "default" | "hero" | "accent";
}) {
  const border =
    variant === "hero"
      ? "3px solid #2563eb"
      : variant === "accent"
        ? "3px solid #0f766e"
        : "1px solid #e5e7eb";

  return (
    <article
      style={{
        padding: variant === "hero" ? "2rem 2.25rem" : "1.75rem 2rem",
        backgroundColor: "#ffffff",
        borderRadius: "1rem",
        border,
        boxShadow:
          variant === "hero"
            ? "0 8px 24px -4px rgba(37, 99, 235, 0.12)"
            : "0 4px 6px -1px rgba(0,0,0,0.06)",
        height: "100%",
      }}
    >
      <header style={{ marginBottom: "1.25rem" }}>
        <h3
          style={{
            fontSize: variant === "hero" ? "1.65rem" : "1.35rem",
            fontWeight: 800,
            color: "#111827",
            margin: 0,
            lineHeight: 1.25,
          }}
        >
          {title}
        </h3>
        {subtitle ? (
          <p style={{ margin: "0.5rem 0 0", color: "#6b7280", fontSize: "0.9rem" }}>{subtitle}</p>
        ) : null}
      </header>
      {children}
    </article>
  );
}

export function ProfileICPLayout({
  text,
  strategicFitItems,
  researchMeta,
  liveCrmHistory,
}: {
  text: string;
  strategicFitItems: StrategicFitItem[];
  researchMeta?: ProfileResearchMeta | null;
  liveCrmHistory?: string;
}) {
  const parsed = parseICPProfile(text);
  const fitNarrative = parsed.strategicFit?.body
    ? stripStrategicFitLinesFromProfile(parsed.strategicFit.body)
    : "";

  return (
    <div className="profile-icp-layout">
      {/* 1. Overview — Company Snapshot + Construction Footprint */}
      <div className="profile-icp-overview-grid">
        <SectionCard
          title="Company Snapshot"
          subtitle="Executive summary — who they are and what matters now"
          variant="hero"
        >
          <ProfileProse body={parsed.snapshot?.body ?? ""} hero />
        </SectionCard>

        <SectionCard
          title="Construction Footprint in Ethiopia"
          subtitle="Plants, units, and construction-related operations"
        >
          <ProfileProse body={parsed.footprint?.body ?? ""} />
        </SectionCard>
      </div>

      {/* 2. Opportunity — Strategic Fit scores */}
      <section style={{ marginTop: "2rem" }}>
        <div style={{ marginBottom: "1rem" }}>
          <h3
            style={{
              fontSize: "1.35rem",
              fontWeight: 800,
              color: "#111827",
              margin: "0 0 0.35rem",
            }}
          >
            Strategic Fit Assessment
          </h3>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.9rem" }}>
            LeanChem alignment by product category — score then rationale below.
          </p>
        </div>
        {fitNarrative.trim() ? (
          <div
            className="card"
            style={{
              marginBottom: "1.25rem",
              padding: "1.25rem 1.5rem",
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            <ProfileProse body={fitNarrative} compact />
          </div>
        ) : null}
        <StrategicFitAssessment items={strategicFitItems} />
      </section>

      {/* 3. Action Plan — Recommended Next Steps */}
      <div style={{ marginTop: "2rem" }}>
        <SectionCard
          title="Recommended Next Steps"
          subtitle="Prioritized actions after reviewing fit — outreach, trials, and contracts"
          variant="accent"
        >
          <ProfileProse body={parsed.nextSteps?.body ?? ""} />
        </SectionCard>
      </div>

      {/* 4. Deep Dive tabs — research sources */}
      <ProfileDeepDiveTabs
        deepDive={parsed.deepDive}
        meta={researchMeta}
        fallbackBody={parsed.researchSummary?.body}
        liveCrmHistory={liveCrmHistory}
      />

      {/* Legacy profiles without numbered sections */}
      {parsed.sections.length === 1 && parsed.sections[0].index === -1 ? (
        <SectionCard title="Full Profile" subtitle="Unsectioned profile text">
          <ProfileProse body={parsed.sections[0].body} />
        </SectionCard>
      ) : null}
    </div>
  );
}
