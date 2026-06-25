import { Briefcase, ClipboardList, Package } from "lucide-react";
import { useLocation } from "react-router-dom";
import { TRADE_TRANSIT_ROUTES } from "../../../contexts/TradeTransitRequestContext";
import { openNewPipelineWindow } from "../../../utils/newPipelineSession";
import {
  TradeTransitHubDeckCard,
  type TradeTransitDeckAccent,
} from "./TradeTransitHubDeckCard";

export type TradeTransitHubModule = "trade" | "products" | "summary";

const decks: Array<{
  id: TradeTransitHubModule;
  href?: string;
  onAction?: () => void;
  icon: typeof Briefcase;
  overline: string;
  title: string;
  description: string;
  buttonLabel: string;
  accent: TradeTransitDeckAccent;
}> = [
  {
    id: "products",
    onAction: openNewPipelineWindow,
    icon: Package,
    overline: "NEW_PIPELINE",
    title: "Add new pipeline",
    description:
      "Open the full manual calculator in a new window — customer request, multiple products, default costing values you can edit, and save.",
    buttonLabel: "Add new pipeline",
    accent: "teal",
  },
  {
    id: "trade",
    href: TRADE_TRANSIT_ROUTES.tradeParameters,
    icon: Briefcase,
    overline: "TRADE_PARAMETERS",
    title: "Trade parameters",
    description:
      "Optional advanced step — incoterms, forex, ports, and commercial terms before costing.",
    buttonLabel: "Open parameters",
    accent: "blue",
  },
  {
    id: "summary",
    href: TRADE_TRANSIT_ROUTES.transitSummary,
    icon: ClipboardList,
    overline: "TRANSIT_SUMMARY",
    title: "Transit summary",
    description:
      "View landed cost, selling rates per kg, and total revenue across product lines.",
    buttonLabel: "View summary",
    accent: "orange",
  },
];

export function TradeTransitHubDecks() {
  const { pathname } = useLocation();

  return (
    <section className="px-4 sm:px-6 lg:px-8 pb-10 sm:pb-14">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 sm:mb-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-500/80 mb-2">
            Modules
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Workspaces
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-2xl font-light">
            Start a new pipeline in a separate window, or open trade parameters,
            history, and transit summary.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {decks.map((deck) => (
            <TradeTransitHubDeckCard
              key={deck.id}
              href={deck.href}
              onAction={deck.onAction}
              icon={deck.icon}
              overline={deck.overline}
              title={deck.title}
              description={deck.description}
              buttonLabel={deck.buttonLabel}
              accent={deck.accent}
              active={deck.href ? pathname === deck.href : false}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
