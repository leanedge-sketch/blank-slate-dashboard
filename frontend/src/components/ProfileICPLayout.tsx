import {
  extractKeyContactsSection,
  extractLinkedInMentions,
  parseICPProfile,
  parseKeyContacts,
  parseNextStepsContent,
  stripStrategicFitLinesFromProfile,
} from "../utils/profileText";
import type { ProfileResearchMeta } from "./ProfileResearchContext";
import { ProfileDeepDiveTabs } from "./ProfileDeepDiveTabs";
import { ProfileProse } from "./ProfileProse";
import { StrategicFitAssessment } from "./StrategicFitAssessment";
import type { StrategicFitItem } from "../utils/profileText";
import { ProfileKeyContacts } from "./profile/ProfileKeyContacts";
import { ProfileNextSteps } from "./profile/ProfileNextSteps";
import type { Interaction } from "../services/api";

export function ProfileICPLayout({
  text,
  strategicFitItems,
  researchMeta,
  mergedInteractions,
}: {
  text: string;
  strategicFitItems: StrategicFitItem[];
  researchMeta?: ProfileResearchMeta | null;
  mergedInteractions?: Interaction[];
}) {
  const parsed = parseICPProfile(text);
  const fitNarrative = parsed.strategicFit?.body
    ? stripStrategicFitLinesFromProfile(parsed.strategicFit.body)
    : "";

  const nextStepsParsed = parseNextStepsContent(
    parsed.nextSteps?.body ?? "",
    strategicFitItems,
  );
  const contactsBlocks = [
    extractKeyContactsSection(parsed.nextSteps?.body ?? ""),
    parsed.deepDive.linkedin,
    extractLinkedInMentions(text),
  ]
    .filter(Boolean)
    .join("\n\n");
  const contacts = parseKeyContacts(contactsBlocks);

  return (
    <div className="flex flex-col gap-8">
      {/* 1. Overview */}
      <section className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <article className="rounded-2xl border-2 border-blue-500 bg-white p-6 sm:p-8 shadow-lg shadow-blue-500/10">
          <header className="mb-5">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight m-0">
              Company Snapshot
            </h2>
            <p className="text-sm text-slate-500 mt-1 mb-0">
              Executive summary — who they are and what matters now
            </p>
          </header>
          <ProfileProse body={parsed.snapshot?.body ?? ""} hero />
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm h-full">
          <header className="mb-5">
            <h2 className="text-xl font-bold text-slate-900 m-0">
              Construction Footprint in Ethiopia
            </h2>
            <p className="text-sm text-slate-500 mt-1 mb-0">
              Plants, units, and construction-related operations
            </p>
          </header>
          <ProfileProse body={parsed.footprint?.body ?? ""} />
        </article>
      </section>

      {/* 2. Strategic fit */}
      <section>
        <header className="mb-4">
          <h2 className="text-xl font-extrabold text-slate-900 m-0">Strategic Fit Assessment</h2>
          <p className="text-sm text-slate-500 mt-1 mb-0">
            LeanChem alignment by product category
          </p>
        </header>
        {fitNarrative.trim() ? (
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <ProfileProse body={fitNarrative} compact />
          </div>
        ) : null}
        <StrategicFitAssessment items={strategicFitItems} />
      </section>

      {/* 3. Recommended next steps */}
      <section className="rounded-2xl border-2 border-teal-600/30 bg-white p-6 sm:p-8 shadow-sm">
        <header className="mb-5">
          <h2 className="text-xl font-extrabold text-slate-900 m-0">Recommended Next Steps</h2>
          <p className="text-sm text-slate-500 mt-1 mb-0">
            Key analysis and next step by product category
          </p>
        </header>
        <ProfileNextSteps
          interactionReview={nextStepsParsed.interactionReview}
          categories={nextStepsParsed.categories}
        />
      </section>

      {/* 4. Key contacts */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <header className="mb-5">
          <h2 className="text-xl font-extrabold text-slate-900 m-0">Key Contacts for Engagement</h2>
          <p className="text-sm text-slate-500 mt-1 mb-0">
            Decision-makers with roles and sources
          </p>
        </header>
        <ProfileKeyContacts contacts={contacts} />
      </section>

      {/* 5. Deep dive */}
      <ProfileDeepDiveTabs
        deepDive={parsed.deepDive}
        meta={researchMeta}
        fallbackBody={parsed.researchSummary?.body}
        mergedInteractions={mergedInteractions}
      />

      {parsed.sections.length === 1 && parsed.sections[0].index === -1 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Full Profile</h2>
          <ProfileProse body={parsed.sections[0].body} />
        </section>
      ) : null}
    </div>
  );
}
