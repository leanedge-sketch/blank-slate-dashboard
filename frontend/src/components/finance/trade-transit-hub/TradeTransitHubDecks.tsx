import { Briefcase, ClipboardList, Package } from "lucide-react";
import {
  TradeTransitHubDeckCard,
  type TradeTransitDeckAccent,
} from "./TradeTransitHubDeckCard";

export type TradeTransitHubModule = "trade" | "products" | "summary";

const decks: Array<{
  id: TradeTransitHubModule;
  icon: typeof Briefcase;
  overline: string;
  title: string;
  description: string;
  buttonLabel: string;
  accent: TradeTransitDeckAccent;
}> = [
  {
    id: "trade",
    icon: Briefcase,
    overline: "TRADE_PARAMETERS",
    title: "Trade & Client Calculator",
    description:
      "Define client details, purchase orders, and core request parameters for new transit calculations.",
    buttonLabel: "Calculate Trade",
    accent: "blue",
  },
  {
    id: "products",
    icon: Package,
    overline: "PRODUCT_COSTING",
    title: "Product Costing Calculator",
    description:
      "Add and manage products, calculate landed costs, selling prices, and payload capacities.",
    buttonLabel: "Calculate Products",
    accent: "teal",
  },
  {
    id: "summary",
    icon: ClipboardList,
    overline: "TRANSIT_SUMMARY",
    title: "Transit Summary Deck",
    description:
      "View the generated breakdown of quantities, landed/selling rates per KG, and total revenue.",
    buttonLabel: "View Summary",
    accent: "orange",
  },
];

type TradeTransitHubDecksProps = {
  activeModule: TradeTransitHubModule | null;
  onSelectModule: (module: TradeTransitHubModule) => void;
};

export function TradeTransitHubDecks({
  activeModule,
  onSelectModule,
}: TradeTransitHubDecksProps) {
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
            Each module opens a focused view below — trade parameters, product
            costing, or the live request summary.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {decks.map((deck) => (
            <TradeTransitHubDeckCard
              key={deck.id}
              icon={deck.icon}
              overline={deck.overline}
              title={deck.title}
              description={deck.description}
              buttonLabel={deck.buttonLabel}
              accent={deck.accent}
              active={activeModule === deck.id}
              onClick={() => onSelectModule(deck.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
