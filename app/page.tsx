"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useWidgetProps,
  useMaxHeight,
  useDisplayMode,
  useRequestDisplayMode,
  useIsChatGptApp,
} from "./hooks";

type ToolOutput = {
  // Backwards compatibility with the starter tool
  name?: string;
  result?: { structuredContent?: { name?: string } };
  // Live kline tool payload
  symbol?: string;
  interval?: string;
  market?: "spot" | "futures";
};

export default function Home() {
  const toolOutput = useWidgetProps<ToolOutput>(() => ({
    symbol: "BTCUSDT",
    interval: "1m",
    market: "futures",
  }));
  const maxHeight = useMaxHeight() ?? undefined;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();
  const isChatGptApp = useIsChatGptApp();

  const name = toolOutput?.result?.structuredContent?.name || toolOutput?.name;
  const symbol = (toolOutput?.symbol ?? "").toUpperCase();
  const interval = toolOutput?.interval ?? "1m";
  const market = toolOutput?.market ?? "futures";

  const [ready, setReady] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const baseUrl = useMemo(
    () => (typeof window !== "undefined" ? window.innerBaseUrl : ""),
    []
  );

  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!chartContainerRef.current) return;
      const { init, dispose } = (await import("klinecharts")) as any;
      if (disposed) return;
      // Dispose previous chart if any
      if (chartRef.current) {
        try {
          dispose(chartRef.current);
        } catch {}
        chartRef.current = null;
      }
      chartRef.current = init(chartContainerRef.current, {
        styles: { candle: { priceMark: { show: true } } },
      });
      setReady(true);

      return () => {
        try {
          if (chartRef.current) dispose(chartRef.current);
        } catch {}
        chartRef.current = null;
      };
    })();
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    // Reconnect stream when symbol or interval changes
    if (!ready || !chartRef.current) return;
    // Close any existing stream
    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
      } catch {}
      eventSourceRef.current = null;
    }
    if (!symbol) return;

    const url = `${baseUrl}/api/kline?symbol=${encodeURIComponent(
      symbol
    )}&interval=${encodeURIComponent(interval)}&market=${encodeURIComponent(
      market
    )}&limit=400`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    let seeded = false;

    es.addEventListener("init", (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        const data = payload?.data || [];
        if (chartRef.current && Array.isArray(data)) {
          chartRef.current.applyNewData(data);
          seeded = true;
        }
      } catch {}
    });

    es.addEventListener("kline", (e: MessageEvent) => {
      try {
        const k = JSON.parse(e.data);
        if (!k || !seeded) return;
        if (chartRef.current) {
          chartRef.current.updateData({
            timestamp: Number(k.timestamp),
            open: Number(k.open),
            high: Number(k.high),
            low: Number(k.low),
            close: Number(k.close),
            volume: Number(k.volume),
          });
        }
      } catch {}
    });

    es.addEventListener("error", () => {
      // Let EventSource auto-retry with backoff; no-op here
    });

    return () => {
      try {
        es.close();
      } catch {}
      eventSourceRef.current = null;
    };
  }, [symbol, interval, ready, baseUrl]);

  return (
    <div
      className="font-sans grid items-center justify-items-center p-4"
      style={{
        maxHeight,
        height: displayMode === "fullscreen" ? maxHeight : undefined,
      }}
    >
      {displayMode !== "fullscreen" && (
        <button
          aria-label="Enter fullscreen"
          className="fixed top-4 right-4 z-50 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-lg ring-1 ring-slate-900/10 dark:ring-white/10 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          onClick={() => requestDisplayMode("fullscreen")}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
            />
          </svg>
        </button>
      )}
      <main className="flex flex-col row-start-2 items-center sm:items-start w-full">
        {!isChatGptApp && (
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 w-full">
            <div className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                  This app relies on data from a ChatGPT session.
                </p>
                <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                  No{" "}
                  <a
                    href="https://developers.openai.com/apps-sdk/reference"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline font-mono bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded"
                  >
                    window.openai
                  </a>{" "}
                  property detected
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="w-full border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden" style={{ height: displayMode === "fullscreen" ? (maxHeight ? Math.max(200, maxHeight - 140) : 500) : 420 }}>
          <div ref={chartContainerRef} className="w-full h-full" />
        </div>
      </main>
    </div>
  );
}
