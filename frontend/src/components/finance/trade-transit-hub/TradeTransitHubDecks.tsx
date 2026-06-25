import { Briefcase, ClipboardList, LayoutDashboard, Package } from "lucide-react";
import { useLocation } from "react-router-dom";
import { TRADE_TRANSIT_ROUTES } from "../../../contexts/TradeTransitRequestContext";
import {
  TradeTransitHubDeckCard,
  type TradeTransitDeckAccent,
} from "./TradeTransitHubDeckCard";

export type TradeTransitHubModule =
  | "trade"
  | "products"
  | "summary"
  | "executive";

const decks: Array<{
  id: TradeTransitHubModule;
  href: string;
  icon: typeof Briefcase;
  overline: string;
  title: string;
  description: string;
  buttonLabel: string;
  accent: TradeTransitDeckAccent;
}> = [
  {
    id: "trade",
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
    id: "products",
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
    id: "summary",
    href: TRADE_TRANSIT_ROUTES.transitSummary,
    icon: ClipboardList,
    overline: "TRANSIT_SUMMARY",
    title: "Transit Summary Deck",
    description:
      "View the generated breakdown of quantities, landed/selling rates per KG, and total revenue.",
    buttonLabel: "View summary",
    accent: "orange",
  },
  {
    id: "executive",
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
    <section className="px-4 sm:px-6 lg:px-8 pb-10 sm:pb-14">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 sm:mb-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-500/80 mb-2">
            Modules
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Choose a workspace deck
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-2xl font-light">
            Each module opens in its own full-page workspace — trade parameters,
            product costing, transit summary, or the Stage 4 executive report.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 sm:gap-8">
          {decks.map((deck) => (
            <TradeTransitHubDeckCard
              key={deck.id}
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
  );
}
