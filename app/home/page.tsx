import Link from "next/link";
import {
  ArrowRight,
  LineChart,
  PlugZap,
  Sparkles,
  Workflow,
  ShieldCheck,
  Clock3,
} from "lucide-react";

export const metadata = {
  title: "ChatGPT Apps · Live Kline Landing",
  description:
    "A focused landing for the Live Kline ChatGPT app and MCP tool, showcasing real-time charting and how to integrate it in ChatGPT Apps.",
};

type FeatureCard = {
  title: string;
  body: string;
  icon: typeof PlugZap;
  accent: "emerald" | "amber" | "sky";
  bullets: string[];
};

const featureCards: FeatureCard[] = [
  {
    title: "MCP-first delivery",
    body: "The /mcp route registers both a widget resource and the live_kline tool so ChatGPT can render and control the chart inside the conversation.",
    icon: PlugZap,
    accent: "emerald",
    bullets: ["Resource id: live-kline-widget", "Tool: live_kline with rich schema", "SDK: mcp-handler"],
  },
  {
    title: "Live market streaming",
    body: "Server-sent events keep the chart in sync with Binance crypto or stock feeds while exposing history via /api/kline/history for context windows.",
    icon: LineChart,
    accent: "amber",
    bullets: ["Real-time kline stream", "150-klines bootstrap", "Overlay + indicator hydration"],
  },
  {
    title: "App-safe UX",
    body: "Widget HTML is sanitized, border-friendly, and honors light/dark themes from the ChatGPT client while keeping external links gated.",
    icon: ShieldCheck,
    accent: "sky",
    bullets: ["openai/widgetAccessible true", "Theme-aware styles", "External link protection"],
  },
];

const steps = [
  {
    title: "1. ChatGPT fetches /mcp",
    detail: "createMcpHandler responds with the widget template (live-kline-widget) plus tool metadata and schema for the model.",
  },
  {
    title: "2. Tool call sets the market",
    detail: "live_kline receives symbol, interval, market, chartType, overlays, and indicators, returning structuredContent that seeds the UI.",
  },
  {
    title: "3. Widget streams data",
    detail: "The UI connects to /api/kline SSE for live candles and /api/ticker/24hr for the rolling price diff.",
  },
  {
    title: "4. Overlays + studies hydrate",
    detail: "After initial data, overlays are drawn and indicators are created on main or sub panes with the provided params.",
  },
];

const quickParams = [
  { label: "symbol", value: "BTCUSDT, ETHUSDT, or 600519.SH" },
  { label: "interval", value: "1m, 5m, 15m, 1h, 4h, 1d, ... (stock default: 1d)" },
  { label: "market", value: "spot, futures, or stock exchange code (SH / SZ)" },
  { label: "chartType", value: "candle_solid, ohlc, area (auto area for 1m stocks)" },
  { label: "timezone", value: "Optional IANA zone like America/Chicago" },
  { label: "overlays", value: "priceLine, segments, fib lines, tags, annotations" },
  { label: "indicators", value: "MA, EMA, MACD, KDJ, RSI, BOLL, VOL, ..." },
];

function AccentIcon({
  icon: Icon,
  accent,
}: {
  icon: typeof PlugZap;
  accent: "emerald" | "amber" | "sky";
}) {
  const styles = {
    emerald:
      "bg-gradient-to-br from-emerald-400/25 via-emerald-500/10 to-emerald-900/40 text-emerald-50 ring-1 ring-emerald-400/50 shadow-[0_15px_45px_-20px_rgba(16,185,129,0.8)]",
    amber:
      "bg-gradient-to-br from-amber-300/30 via-amber-400/15 to-amber-900/30 text-amber-50 ring-1 ring-amber-300/50 shadow-[0_15px_45px_-20px_rgba(251,191,36,0.8)]",
    sky:
      "bg-gradient-to-br from-sky-300/30 via-sky-400/15 to-sky-900/35 text-sky-50 ring-1 ring-sky-300/50 shadow-[0_15px_45px_-20px_rgba(125,211,252,0.8)]",
  } as const;

  return (
    <span
      className={`inline-flex aspect-square w-10 items-center justify-center rounded-md backdrop-blur-sm p-2 ${styles[accent]}`}
    >
      <Icon className="h-3 w-3" />
    </span>
  );
}

export default function HomeLanding() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.15),transparent_36%),radial-gradient(circle_at_80%_0%,rgba(251,191,36,0.14),transparent_32%),linear-gradient(135deg,#0a1020,#05070f)]" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-20">
        <header className="flex items-center justify-between gap-4 pt-10 text-sm text-slate-200">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 uppercase tracking-[0.25em] text-[11px] text-emerald-200">
            <Sparkles className="h-4 w-4" />
            ChatGPT Apps
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://chatgpt.com"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-slate-100 transition hover:border-emerald-400/60 hover:text-emerald-100"
            >
              Live Chart
            </a>
            <Link
              href="/mcp"
              className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 text-emerald-100 transition hover:bg-emerald-500/20"
            >
              MCP Route
            </Link>
          </div>
        </header>

        <main className="mt-12 grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-6">
            <p className="inline-flex items-center gap-3 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100">
              <Clock3 className="h-4 w-4" />
              Live kline widget for ChatGPT Apps
            </p>

            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Real-time charts, instrumented
              <span className="block bg-gradient-to-r from-emerald-200 via-white to-amber-200 bg-clip-text text-transparent">
                for the ChatGPT Apps runtime.
              </span>
            </h1>

            <p className="max-w-2xl text-lg text-slate-200/90">
              Ship a production-ready widget that streams prices, renders overlays, and exposes a typed tool call. The core logic lives in <code className="rounded bg-white/5 px-2 py-1 text-sm text-emerald-100">app/mcp/route.ts</code> so your app and the model stay in sync.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <a
                href="https://chatgpt.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-5 py-3 text-slate-900 font-semibold shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-300"
              >
                Try the live chart
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="/api/kline?symbol=BTCUSDT&interval=1m&market=futures&limit=60"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-slate-100 transition hover:border-amber-300/50 hover:text-amber-100"
              >
                Peek the data feed
              </a>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200/80">
                <ShieldCheck className="h-4 w-4" />
                Widget accessible + resultCanProduceWidget
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3 text-sm text-emerald-100">
                  <LineChart className="h-4 w-4" />
                  Streaming via EventSource
                </div>
                <p className="mt-2 text-sm text-slate-200/80">
                  SSE keeps candles, overlays, and tickers live while loadMore fetches history seamlessly.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3 text-sm text-amber-100">
                  <Workflow className="h-4 w-4" />
                  Typed tool schema
                </div>
                <p className="mt-2 text-sm text-slate-200/80">
                  zod-powered inputs for symbol, market, overlays, and indicators so the model stays deterministic.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-6 shadow-[0_30px_120px_-60px_rgba(0,0,0,0.8)] backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Tool</p>
                <h2 className="text-2xl font-semibold text-white">live_kline</h2>
                <p className="text-sm text-slate-200/80">Registered in app/mcp/route.ts</p>
              </div>
              <span className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
                Widget ready
              </span>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/80 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                Inputs
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-100/90">
                {quickParams.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2"
                  >
                    <span className="font-semibold text-white">{item.label}</span>
                    <span className="text-right text-slate-200/80">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
                Example tool call
              </div>
              <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950/80 p-4 text-xs text-emerald-50">
{`{
  "symbol": "BTCUSDT",
  "interval": "1m",
  "market": "futures",
  "chartType": "candle_solid",
  "overlays": [
    { "name": "priceLine", "points": [{ "value": 43250 }] },
    { "name": "simpleTag", "points": [{ "value": 43000 }], "extendData": "support" }
  ],
  "indicators": [
    { "name": "EMA", "params": [20, 50], "pane": "main" },
    { "name": "MACD", "pane": "sub" }
  ]
}`}
              </pre>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200/85">
              <p className="font-semibold text-white">Structured content returned</p>
              <p className="mt-2">
                The tool echoes your params, attaches up to 150 klines for grounding, and signals widget accessibility via openai/resultCanProduceWidget.
              </p>
            </div>
          </section>
        </main>

        <section className="mt-14 grid gap-6 md:grid-cols-3">
          {featureCards.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_80px_-60px_rgba(0,0,0,0.9)]"
              >
                <div className="flex items-start gap-3">
                  <AccentIcon icon={Icon} accent={feature.accent} />
                  <div>
                    <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                    <p className="mt-2 text-sm text-slate-200/80">{feature.body}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-100/90">
                  {feature.bullets.map((bullet) => (
                    <span
                      key={bullet}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1"
                    >
                      {bullet}
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-16 rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Flow</p>
              <h3 className="text-2xl font-semibold text-white">How the ChatGPT app runs</h3>
              <p className="mt-2 max-w-2xl text-sm text-slate-200/85">
                Everything pivots around <code className="rounded bg-white/10 px-2 py-1 text-emerald-100">app/mcp/route.ts</code>: it serves widget HTML, validates inputs, and streams structured content that keeps the UI + model in lockstep.
              </p>
            </div>
            <Link
              href="/mcp"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-amber-400/90 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/30 transition hover:-translate-y-0.5"
            >
              Open /mcp response
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {steps.map((step) => (
              <div
                key={step.title}
                className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-4"
              >
                <p className="text-sm font-semibold text-white">{step.title}</p>
                <p className="mt-1 text-sm text-slate-200/80">{step.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-slate-50">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">Ready to ship</p>
              <h3 className="text-xl font-semibold">Drop it in ChatGPT Apps or reuse the widget standalone.</h3>
              <p className="mt-1 text-sm text-emerald-50/90">
                Use the chart UI at <code className="rounded bg-white/20 px-2 py-1">/</code> or let the model call <code className="rounded bg-white/20 px-2 py-1">live_kline</code>—both paths reuse the same HTML and streaming stack.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://chatgpt.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-white/30 transition hover:-translate-y-0.5"
              >
                Launch widget
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                href="/home"
                className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
              >
                Stay on landing
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
