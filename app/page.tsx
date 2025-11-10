"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useWidgetProps,
  useMaxHeight,
  useDisplayMode,
  useRequestDisplayMode,
  useIsChatGptApp,
} from "./hooks";
import PriceWithDiff from "./components/PriceWithDiff";
import Skeleton from "./components/Skeleton";

type ToolOutput = {
  // Live kline tool payload
  symbol?: string;
  interval?: string;
  market?: "spot" | "futures";
  chartType?: "candle_solid" | "candle_stroke" | "candle_up_stroke" | "candle_down_stroke" | "ohlc" | "area";
  timezone?: string;
  indicators?: Array<{ name: string; params?: number[]; pane?: "main" | "sub" }>;
};

export default function Home() {
  const toolOutput = useWidgetProps<ToolOutput>();
  const maxHeight = useMaxHeight() ?? undefined;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();
  const isChatGptApp = useIsChatGptApp();

  const symbol = toolOutput?.symbol ? toolOutput.symbol.toUpperCase() : "";
  const interval = toolOutput?.interval ?? "1m";
  const market = toolOutput?.market ?? "futures";
  const chartType = toolOutput?.chartType ?? "candle_solid";
  const timezone = toolOutput?.timezone;
  const indicators = toolOutput?.indicators ?? [];
  
  const hasToolData = !!toolOutput;

  const [ready, setReady] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange24h, setPriceChange24h] = useState<number>(0);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const tickerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const baseUrl = useMemo(
    () => (typeof window !== "undefined" ? window.innerBaseUrl : ""),
    []
  );

  useEffect(() => {
    if (!hasToolData) return;
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
        styles: { 
          candle: { 
            priceMark: { show: true },
            type: chartType as any
          } 
        },
      });
      if (timezone && chartRef.current) {
        chartRef.current.setTimezone(timezone);
      }
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
  }, [chartType, timezone, hasToolData]);

  // Update chart type when it changes
  useEffect(() => {
    if (!ready || !chartRef.current || !hasToolData) return;
    chartRef.current.setStyles({
      candle: {
        type: chartType as any
      }
    });
  }, [chartType, ready, hasToolData]);

  // Update timezone when it changes
  useEffect(() => {
    if (!ready || !chartRef.current || !hasToolData) return;
    if (timezone) {
      chartRef.current.setTimezone(timezone);
    }
  }, [timezone, ready, hasToolData]);

  // Update indicators when they change
  useEffect(() => {
    if (!ready || !chartRef.current || !hasToolData) return;
    
    // Remove all existing indicators first
    try {
      const allIndicators = chartRef.current.getIndicators();
      if (Array.isArray(allIndicators)) {
        allIndicators.forEach((ind: any) => {
          try {
            if (ind && ind.id) {
              chartRef.current.removeIndicator(ind.id);
            }
          } catch {}
        });
      }
    } catch {}
    
    // Add new indicators with parameters
    if (indicators.length > 0) {
      indicators.forEach((indicator) => {
        try {
          const isMainPane = indicator.pane !== "sub";
          // First parameter: indicator config object with name and calcParams
          const indicatorConfig: any = {
            name: indicator.name,
          };
          if (indicator.params && Array.isArray(indicator.params) && indicator.params.length > 0) {
            indicatorConfig.calcParams = indicator.params;
          }
          
          // Second parameter: whether to replace existing (false = add new)
          // Third parameter: pane options - main pane needs id: 'candle_pane', sub pane doesn't need id
          const paneOptions = isMainPane ? { id: 'candle_pane' } : {};
          
          chartRef.current.createIndicator(indicatorConfig, true, paneOptions);
        } catch (err) {
          // Silently fail if indicator is invalid
          console.warn('Failed to create indicator:', indicator.name, err);
        }
      });
    }
  }, [indicators, ready, hasToolData]);

  useEffect(() => {
    // Reconnect stream when symbol or interval changes
    if (!ready || !chartRef.current || !hasToolData) return;
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
          chartRef.current.setStyles('dark')
          chartRef.current.applyNewData(data, true);
          seeded = true;

          // Setup loadMore after initial data is loaded
          if (chartRef.current && typeof chartRef.current.loadMore === "function") {
            chartRef.current.loadMore((timestamp: number) => {
              // Fetch historical data
              const historyUrl = `${baseUrl}/api/kline/history?symbol=${encodeURIComponent(
                symbol
              )}&interval=${encodeURIComponent(interval)}&market=${encodeURIComponent(
                market
              )}&limit=100&endTime=${timestamp}`;
              
              fetch(historyUrl)
                .then((res) => res.json())
                .then((result) => {
                  if (chartRef.current && result?.data && Array.isArray(result.data)) {
                    chartRef.current.applyMoreData(result.data, true);
                  }
                })
                .catch(() => {
                  // Silently fail
                });
            });
          }
        }
      } catch {}
    });

    es.addEventListener("kline", (e: MessageEvent) => {
      try {
        const k = JSON.parse(e.data);
        if (!k || !seeded) return;
        const closePrice = Number(k.close);
        setCurrentPrice(closePrice);
        if (chartRef.current) {
          chartRef.current.updateData({
            timestamp: Number(k.timestamp),
            open: Number(k.open),
            high: Number(k.high),
            low: Number(k.low),
            close: closePrice,
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
  }, [symbol, interval, market, ready, baseUrl, hasToolData]);

  // Fetch 24hr ticker data
  useEffect(() => {
    if (!symbol || !hasToolData) return;

    const fetchTicker = async () => {
      try {
        const url = `${baseUrl}/api/ticker/24hr?symbol=${encodeURIComponent(
          symbol
        )}&market=${encodeURIComponent(market)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.price) setCurrentPrice(data.price);
          if (data.priceChangePercent !== undefined)
            setPriceChange24h(data.priceChangePercent);
        }
      } catch {}
    };

    fetchTicker();
    tickerIntervalRef.current = setInterval(fetchTicker, 5000);

    return () => {
      if (tickerIntervalRef.current) {
        clearInterval(tickerIntervalRef.current);
        tickerIntervalRef.current = null;
      }
    };
  }, [symbol, market, baseUrl, hasToolData]);

  if (!hasToolData) {
    return (
      <div
        className="font-sans grid items-center justify-items-center p-4"
        style={{
          maxHeight,
          height: displayMode === "fullscreen" ? maxHeight : undefined,
        }}
      >
        <div className="w-full rounded-md overflow-hidden" style={{ height: displayMode === "fullscreen" ? (maxHeight ? Math.max(200, maxHeight - 140) : 500) : 420 }}>
          <Skeleton width="100%" height="100%" />
        </div>
      </div>
    );
  }

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

        {currentPrice > 0 && (
          <div className="w-full mb-3">
            <PriceWithDiff value={currentPrice} diff={priceChange24h} />
          </div>
        )}

        <div className="w-full border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden" style={{ height: displayMode === "fullscreen" ? (maxHeight ? Math.max(200, maxHeight - 140) : 500) : 420 }}>
          <div ref={chartContainerRef} className="w-full h-full" />
        </div>
      </main>
    </div>
  );
}
