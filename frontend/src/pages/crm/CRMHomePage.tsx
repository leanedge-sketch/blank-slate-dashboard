import { Link } from "react-router-dom";
import {
  Users,
  MessageSquare,
  FileText,
  BarChart3,
  Zap,
  Download,
  ArrowRight,
  Sparkles,
  UserPlus,
  Target,
} from "lucide-react";

const features = [
    {
      icon: UserPlus,
      title: "Add Customer",
      description:
        "Create new customer records with company details, website, LinkedIn, and primary contact information.",
      href: "/crm/customers/new",
      cta: "Add customer",
      accent: "from-blue-600 via-blue-500 to-cyan-500",
      accentHover: "group-hover:shadow-blue-500/40",
      bgAccent: "bg-blue-500/20",
    },
    {
      icon: Target,
      title: "ICP Workspace",
      description:
        "View and manage Ideal Customer Profiles. Edit, download, rate, and provide feedback to improve AI-generated profiles.",
      href: "/crm/customers",
      cta: "Open ICP workspace",
      accent: "from-purple-600 via-purple-500 to-pink-500",
      accentHover: "group-hover:shadow-purple-500/40",
      bgAccent: "bg-purple-500/20",
    },
    {
      icon: FileText,
      title: "Customer Interactions & History",
      description:
        "View, add, edit, and delete customer interactions. Chat with AI assistant and manage conversation history.",
      href: "/crm/customers/manage",
      cta: "View interactions",
      accent: "from-emerald-600 via-emerald-500 to-teal-500",
      accentHover: "group-hover:shadow-emerald-500/40",
      bgAccent: "bg-emerald-500/20",
    },
    {
      icon: BarChart3,
      title: "CRM dashboard & AI questions",
      description:
        "See high-level CRM metrics and ask natural language questions. Answer using RAG over your interactions.",
      href: "/crm/dashboard",
      cta: "Open dashboard",
      accent: "from-indigo-600 via-indigo-500 to-blue-500",
      accentHover: "group-hover:shadow-indigo-500/40",
      bgAccent: "bg-indigo-500/20",
    },
    {
      icon: Download,
      title: "Reports & exports",
      description: "Generate summary views of your CRM activity. Filter and export to CSV / PDF.",
      href: "/crm/reports",
      cta: "View reports",
      accent: "from-green-600 via-green-500 to-emerald-500",
      accentHover: "group-hover:shadow-green-500/40",
      bgAccent: "bg-green-500/20",
    },
  ];

export function CRMHomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Primary gradient orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
        <div
          className="absolute top-1/2 right-0 w-72 h-72 bg-cyan-600/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>

        {/* Grid overlay */}
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]"></div>
      </div>

      <div className="relative z-10">
        {/* Hero Section */}
        <div className="px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 lg:pt-32 pb-8 sm:pb-12">
          <div className="max-w-5xl mx-auto">
            {/* Animated badge */}
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/40 mb-8 sm:mb-10 backdrop-blur-sm hover:border-blue-400/60 transition-all duration-300">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
              </span>
              <span className="text-xs sm:text-sm font-semibold bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
                ✨ Welcome to your AI-powered CRM workspace
              </span>
            </div>

            {/* Main heading with enhanced typography */}
            <div className="space-y-6 sm:space-y-8">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tighter leading-tight">
                <span className="block">Your Central</span>
                <span className="block bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent animate-gradient">
                  Hub for Success
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-300 max-w-3xl leading-relaxed font-light">
                Manage customers, leverage AI-assisted interactions, generate professional quotes, and analyze your
                pipeline—all in one beautifully designed workspace that grows with your business.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4 flex-wrap">
                <Link
                  to="/crm/customers/new"
                  className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-lg transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/40 hover:-translate-y-1 active:translate-y-0 group"
                >
                  Get Started
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/crm/dashboard"
                  className="inline-flex items-center justify-center px-8 py-4 rounded-xl border-2 border-slate-600 text-white font-bold text-lg transition-all duration-300 hover:border-slate-400 hover:bg-slate-800/30 backdrop-blur-sm"
                >
                  Explore Dashboard
                </Link>
                <Link
                  to="/crm/customers"
                  className="inline-flex items-center justify-center px-8 py-4 rounded-xl border-2 border-emerald-500/70 text-emerald-300 font-bold text-lg transition-all duration-300 hover:border-emerald-300 hover:bg-emerald-500/10 backdrop-blur-sm"
                >
                  ICP Workspace
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28">
          <div className="max-w-7xl mx-auto">
            {/* Section Header */}
            <div className="mb-12 sm:mb-16 lg:mb-20">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-bold text-blue-400 uppercase tracking-wider">Features</span>
              </div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-4 tracking-tight">
                Everything you need
              </h2>
              <p className="text-lg sm:text-xl text-slate-400 max-w-2xl font-light">
                Powerful tools designed to streamline your customer relationships and accelerate your pipeline.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {features.map((feature, index) => {
                const Icon = feature.icon
                return (
                  <div
                    key={index}
                    className="crm-feature-card-enhanced group relative h-full overflow-hidden rounded-2xl"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800/40 via-slate-900/40 to-black/20 rounded-2xl border border-slate-700/50 transition-all duration-500 group-hover:border-slate-600 group-hover:from-slate-800/60 group-hover:via-slate-800/40 group-hover:to-slate-900/30"></div>

                    {/* Glowing accent top border */}
                    <div
                      className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${feature.accent} rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg ${feature.accentHover}`}
                    ></div>

                    {/* Subtle background glow on hover */}
                    <div
                      className={`absolute -inset-px bg-gradient-to-r ${feature.accent} rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-xl`}
                    ></div>

                    {/* Content Container */}
                    <div className="relative p-7 sm:p-8 flex flex-col h-full">
                      {/* Icon Container */}
                      <div
                        className={`inline-flex w-14 h-14 sm:w-16 sm:h-16 items-center justify-center rounded-xl bg-gradient-to-br ${feature.accent} p-3 sm:p-4 mb-6 sm:mb-8 group-hover:scale-125 transition-all duration-300 shadow-lg ${feature.accentHover}`}
                      >
                        <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-white" strokeWidth={1.5} />
                      </div>

                      {/* Title */}
                      <h3 className="text-xl sm:text-2xl font-black text-white mb-3 sm:mb-4 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-300 group-hover:to-cyan-300 group-hover:bg-clip-text transition-all duration-300 leading-tight">
                        {feature.title}
                      </h3>

                      {/* Description */}
                      <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-7 sm:mb-10 flex-grow font-light">
                        {feature.description}
                      </p>

                      {/* CTA Button */}
                      <Link
                        to={feature.href}
                        className={`inline-flex items-center justify-center px-6 py-3 rounded-lg bg-gradient-to-r ${feature.accent} text-white font-bold text-sm sm:text-base transition-all duration-300 hover:shadow-xl ${feature.accentHover} hover:-translate-y-1 active:translate-y-0 group/btn`}
                      >
                        {feature.cta}
                        <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-t border-slate-800/50">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { label: "Active Features", value: "6+" },
                { label: "AI Integration", value: "100%" },
                { label: "Data Security", value: "Bank-Grade" },
                { label: "Uptime", value: "99.9%" },
              ].map((stat, idx) => (
                <div key={idx} className="group text-center hover:scale-105 transition-transform duration-300">
                  <div className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                    {stat.value}
                  </div>
                  <p className="text-slate-400 text-sm sm:text-base font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 border-t border-slate-800/50">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="group">
                <h4 className="text-white font-bold text-lg mb-4 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-cyan-400 group-hover:bg-clip-text transition-all duration-300">
                  🚀 Quick Start
                </h4>
                <p className="text-slate-400 text-sm leading-relaxed font-light">
                  Get up and running with your CRM in minutes. Intuitive interface designed for rapid adoption.
                </p>
              </div>
              <div className="group">
                <h4 className="text-white font-bold text-lg mb-4 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-cyan-400 group-hover:bg-clip-text transition-all duration-300">
                  ⚡ AI-Powered
                </h4>
                <p className="text-slate-400 text-sm leading-relaxed font-light">
                  Leverage advanced AI assistance for smarter customer interactions and insights.
                </p>
              </div>
              <div className="group">
                <h4 className="text-white font-bold text-lg mb-4 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-cyan-400 group-hover:bg-clip-text transition-all duration-300">
                  🎯 All-in-One
                </h4>
                <p className="text-slate-400 text-sm leading-relaxed font-light">
                  Manage customers, quotes, and analytics in one beautifully cohesive platform.
                </p>
              </div>
            </div>
            <div className="mt-12 pt-8 border-t border-slate-800/30 text-center text-slate-500 text-sm font-light">
              <p>© 2025 CRM Workspace. Crafted with precision for modern sales teams.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
