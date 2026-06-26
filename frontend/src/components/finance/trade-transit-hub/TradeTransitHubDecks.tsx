import { Briefcase, ClipboardList, LayoutDashboard, Package, Sparkles } from "lucide-react";
import { useLocation } from "react-router-dom";
import { TRADE_TRANSIT_ROUTES } from "../../../contexts/TradeTransitRequestContext";
import {
  TradeTransitHubDeckCard,
  type TradeTransitDeckAccent,
} from "./TradeTransitHubDeckCard";

type DeckConfig = {
  href: string;
  icon: typeof Briefcase;
  overline: string;
  title: string;
  description: string;
  buttonLabel: string;
  accent: TradeTransitDeckAccent;
};

const workspaceDecks: DeckConfig[] = [
  {
    href: TRADE_TRANSIT_ROUTES.tradeParameters,
    icon: Briefcase,
    overline: "TRADE_PARAMETERS",
    title: "Trade Parameters Workspace",
    description:
      "Define client details, commercial terms, forex, and routing before any costing begins.",
    buttonLabel: "Open workspace",
    accent: "blue",
  },
  {
    href: TRADE_TRANSIT_ROUTES.productCosting,
    icon: Package,
    overline: "PRODUCT_COSTING",
    title: "Product Costing Calculator",
    description:
      "Add and manage products, calculate landed costs, selling prices, and payload capacities.",
    buttonLabel: "Calculate products",
    accent: "teal",
  },
  {
    href: TRADE_TRANSIT_ROUTES.transitSummary,
    icon: ClipboardList,
    overline: "TRANSIT_SUMMARY",
    title: "Transit Summary Deck",
    description:
      "View the generated breakdown of quantities, landed/selling rates per KG, and total revenue.",
    buttonLabel: "View summary",
    accent: "orange",
  },
];

const reportDecks: DeckConfig[] = [
  {
    href: TRADE_TRANSIT_ROUTES.executiveReport,
    icon: LayoutDashboard,
    overline: "STAGE_4_EXECUTIVE",
    title: "Executive Report Dashboard",
    description:
      "Interactive BI with product and customer cross-filtering, cost charts, cognitive summaries, and PDF export.",
    buttonLabel: "Open executive report",
    accent: "violet",
  },
];

export function TradeTransitHubDecks() {
  const { pathname } = useLocation();

  return (
    <>
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10 sm:mb-14">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <span className="text-sm font-bold text-cyan-400 uppercase tracking-wider">
                Workspaces
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 tracking-tight">
              Choose a workspace deck
            </h2>
            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl font-light">
              Trade parameters, product costing, and transit summary — each opens in its own
              full-page workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {workspaceDecks.map((deck) => (
              <TradeTransitHubDeckCard
                key={deck.href}
                href={deck.href}
                icon={deck.icon}
                overline={deck.overline}
                title={deck.title}
                description={deck.description}
                buttonLabel={deck.buttonLabel}
                accent={deck.accent}
                active={pathname === deck.href}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20 lg:pb-28 border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto pt-12 sm:pt-16">
          <div className="mb-10 sm:mb-14">
            <div className="flex items-center gap-2 mb-4">
              <LayoutDashboard className="w-5 h-5 text-violet-400" />
              <span className="text-sm font-bold text-violet-400 uppercase tracking-wider">
                Report &amp; analysis
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 tracking-tight">
              Executive intelligence
            </h2>
            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl font-light">
              Stage 4 cross-filter dashboards, cost structure charts, and exportable summaries.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {reportDecks.map((deck) => (
              <TradeTransitHubDeckCard
                key={deck.href}
                href={deck.href}
                icon={deck.icon}
                overline={deck.overline}
                title={deck.title}
                description={deck.description}
                buttonLabel={deck.buttonLabel}
                accent={deck.accent}
                active={pathname === deck.href}
              />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
