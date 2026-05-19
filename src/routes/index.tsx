import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowRightLeft,
  Boxes,
  ListOrdered,
  PackageSearch,
  Sparkles,
  TrendingUp,
  Warehouse,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — LeanChem Connect" },
      {
        name: "description",
        content:
          "Unified operations dashboard for logistics, stock, and inter-company transfers.",
      },
    ],
  }),
  component: DashboardPage,
});

const kpis = [
  {
    label: "Active Locations",
    value: "4",
    helper: "Warehouses tracked in real-time",
    icon: Warehouse,
    tone: "bg-emerald-100 text-emerald-700",
  },
  {
    label: "Tracked SKUs",
    value: "—",
    helper: "Connect product catalog",
    icon: Boxes,
    tone: "bg-sky-100 text-sky-700",
  },
  {
    label: "Movements (30d)",
    value: "—",
    helper: "Ledger entries this month",
    icon: TrendingUp,
    tone: "bg-amber-100 text-amber-700",
  },
  {
    label: "Pending Transfers",
    value: "—",
    helper: "Inter-company in flight",
    icon: ArrowRightLeft,
    tone: "bg-indigo-100 text-indigo-700",
  },
];

const modules = [
  {
    title: "Stock Availability",
    description:
      "Aggregate, real-time net balances per operational location with executive KPIs.",
    href: "/logistics/stock-availability",
    icon: PackageSearch,
    accent: "from-emerald-500/10 to-emerald-500/0",
  },
  {
    title: "Stock Movements",
    description:
      "Full ledger of purchases, sales, samples, damages, and transfers with color-coded events.",
    href: "/logistics/stock-movements",
    icon: ListOrdered,
    accent: "from-sky-500/10 to-sky-500/0",
  },
  {
    title: "Inter-Company Transfers",
    description:
      "Record balanced ledger entries between LeanChem entities in a single atomic action.",
    href: "/logistics/intercompany-transfer",
    icon: ArrowRightLeft,
    accent: "from-indigo-500/10 to-indigo-500/0",
  },
];

function DashboardPage() {
  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Operations Overview
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Welcome back
            </h1>
            <p className="max-w-2xl text-sm text-slate-600">
              A single, unified workspace for logistics, stock balances, and
              inter-company movements across LeanChem entities.
            </p>
          </div>
          <Button asChild size="lg" className="shadow-sm hover:shadow-md transition-shadow">
            <Link to="/logistics/stock-availability">
              View live stock
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* KPI grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  {kpi.label}
                </CardTitle>
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${kpi.tone}`}
                >
                  <kpi.icon className="h-4 w-4" />
                </span>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight text-slate-900">
                  {kpi.value}
                </div>
                <p className="mt-1 text-xs text-slate-500">{kpi.helper}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Module shortcuts */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Jump into a module
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {modules.map((m) => (
              <Link
                key={m.href}
                to={m.href}
                className="group block focus:outline-none"
              >
                <Card className="h-full overflow-hidden bg-white transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
                  <div
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${m.accent} opacity-0 transition-opacity group-hover:opacity-100`}
                  />
                  <CardHeader>
                    <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200">
                      <m.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base font-semibold text-slate-900">
                      {m.title}
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-600">
                      {m.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 group-hover:text-slate-900">
                      Open
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
