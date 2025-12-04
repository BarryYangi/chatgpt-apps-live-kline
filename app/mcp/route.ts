import { baseURL } from "@/baseUrl";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const getAppsSdkCompatibleHtml = async (baseUrl: string, path: string) => {
  const result = await fetch(`${baseUrl}${path}`);
  return await result.text();
};

type ContentWidget = {
  id: string;
  title: string;
  templateUri: string;
  invoking: string;
  invoked: string;
  html: string;
  description: string;
  widgetDomain: string;
};

function widgetMeta(widget: ContentWidget) {
  return {
    "openai/outputTemplate": widget.templateUri,
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true,
  } as const;
}

const handler = createMcpHandler(async (server) => {
  const html = await getAppsSdkCompatibleHtml(baseURL, "/");

  const liveKlineWidget: ContentWidget = {
    id: "live_kline",
    title: "Live Kline",
    templateUri: "ui://widget/content-template.html",
    invoking: "Loading chart...",
    invoked: "Chart loaded",
    html: html,
    description: "Displays live candlestick chart from Binance (crypto) or stock market",
    widgetDomain: "https://nextjs.org/docs",
  };

  server.registerResource(
    "live-kline-widget",
    liveKlineWidget.templateUri,
    {
      title: liveKlineWidget.title,
      description: liveKlineWidget.description,
      mimeType: "text/html+skybridge",
      _meta: {
        "openai/widgetDescription": liveKlineWidget.description,
        "openai/widgetPrefersBorder": true,
      },
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/html+skybridge",
          text: `<html>${liveKlineWidget.html}</html>`,
          _meta: {
            "openai/widgetDescription": liveKlineWidget.description,
            "openai/widgetPrefersBorder": true,
            // "openai/widgetDomain": liveKlineWidget.widgetDomain,
          },
        },
      ],
    })
  );

  // Live Kline chart tool: sets symbol/interval to drive UI
  server.registerTool(
    "live_kline",
    {
      title: "Live Kline",
      description:
        "Render a live candlestick chart from Binance (crypto) or stock market via real-time streaming. Supports crypto (spot/futures) and stocks. For crypto, provide symbol like BTCUSDT. For stocks, provide symbol with exchange suffix like 600519.SH. Default interval for stocks is 1d, for crypto is 1m. Stock market with 1m interval will automatically use area chart.",
      inputSchema: {
        symbol: z
          .string()
          .min(3)
          .describe("Trading symbol. For crypto: BTCUSDT, ETHUSDT. For stocks: 600519.SH (Shanghai), 000001.SZ (Shenzhen)"),
        interval: z
          .enum([
            "1m",
            "3m",
            "5m",
            "15m",
            "30m",
            "1h",
            "2h",
            "4h",
            "6h",
            "8h",
            "12h",
            "1d",
            "3d",
            "1w",
            "1M",
          ])
          .optional()
          .describe("Kline interval. Default: 1d for stocks, 1m for crypto."),
        market: z
          .string()
          .describe("Market type (required): 'spot' (crypto spot), 'futures' (crypto futures), or stock exchange code like 'SH' (Shanghai), 'SZ' (Shenzhen). Any value other than 'spot' or 'futures' will be treated as stock market."),
        chartType: z
          .enum([
            "candle_solid",
            "candle_stroke",
            "candle_up_stroke",
            "candle_down_stroke",
            "ohlc",
            "area",
          ])
          .optional()
          .describe("Chart type: candle_solid, candle_stroke, candle_up_stroke, candle_down_stroke, ohlc, or area (default candle_solid)"),
        timezone: z
          .string()
          .optional()
          .describe("Timezone for the chart (e.g., Asia/Shanghai, Europe/Berlin, America/Chicago, UTC). Default is browser timezone."),
        overlays: z
          .array(
            z.object({
              name: z.enum([
                "horizontalRayLine",
                "horizontalSegment",
                "horizontalStraightLine",
                "verticalRayLine",
                "verticalSegment",
                "verticalStraightLine",
                "rayLine",
                "segment",
                "straightLine",
                "priceLine",
                "priceChannelLine",
                "parallelStraightLine",
                "fibonacciLine",
                "simpleAnnotation",
                "simpleTag",
              ]).describe(
                "Built-in overlay type. Use built-ins only; custom overlays are not supported here."
              ),
              points: z
                .array(
                  z.object({
                    timestamp: z.number().optional().describe("Unix ms timestamp of the candle"),
                    value: z.number().optional().describe("Price value at y-axis"),
                  })
                )
                .min(1)
                .describe(
                  "Overlay points. Provide timestamp/value pairs where required by the overlay: " +
                    "- horizontal* accept value only; - vertical* accept timestamp only; " +
                    "- lines/channels require timestamp+value for each point; - simpleTag can be value only; - simpleAnnotation needs timestamp+value."
                ),
              extendData: z.string().optional().describe("Optional extendData passed to klinecharts overlay"),
              styles: z.record(z.any()).optional().describe("Optional styles object for overlay"),
              paneId: z.string().optional().describe("Target pane id. Use 'candle_pane' for main chart."),
              id: z.string().optional(),
              groupId: z.string().optional(),
              lock: z.boolean().optional(),
              visible: z.boolean().optional(),
              zLevel: z.number().optional(),
              mode: z.enum(['normal','weak_magnet','strong_magnet']).optional(),
              modeSensitivity: z.number().optional(),
            })
          )
          .optional()
          .describe(
            "Define overlays to draw automatically AFTER initial chart data is loaded. Points are applied directly without interactive selection. Required points by type: " +
            "priceLine: 1(value); simpleTag: 1(value) [extendData optional]; simpleAnnotation: 1(timestamp+value) [extendData optional]; " +
            "horizontalStraightLine: 1(value); horizontalRayLine: 1(value) [timestamp optional]; horizontalSegment: 2(timestamp, value same y); " +
            "verticalStraightLine: 1(timestamp); verticalRayLine: 1(timestamp); verticalSegment: 2(value) at same timestamp; " +
            "rayLine/segment/straightLine: 2(timestamp+value each); fibonacciLine: 2(timestamp+value each); " +
            "parallelStraightLine/priceChannelLine: 3(timestamp+value for first two to set base; third value sets parallel distance)."
          ),
        indicators: z
          .array(
            z.object({
              name: z
                .enum([
                  "MA",
                  "EMA",
                  "SMA",
                  "BOLL",
                  "SAR",
                  "BBI",
                  "MACD",
                  "KDJ",
                  "RSI",
                  "WR",
                  "CCI",
                  "DMI",
                  "TRIX",
                  "OBV",
                  "VOL",
                  "VR",
                  "CR",
                  "PSY",
                  "BRAR",
                  "DMA",
                  "MTM",
                  "EMV",
                  "AO",
                  "PVT",
                  "BIAS",
                  "ROC",
                  "AVP",
                ])
                .describe("Indicator name"),
              params: z
                .array(z.number())
                .optional()
                .describe(
                  "Indicator parameters as an array of numbers. IMPORTANT: If you need multiple parameter values for the same indicator (e.g., MA with periods 120 and 240), combine them into a single array [120, 240] in ONE indicator object. Do NOT create multiple indicator objects with the same name and pane. " +
                  "Default values: " +
                  "MA: [5, 10, 30, 60], EMA: [6, 12, 20], SMA: [12, 2], BBI: [3, 6, 12, 24], " +
                  "VOL: [5, 10, 20], MACD: [12, 26, 9], BOLL: [20, 2], KDJ: [9, 3, 3], " +
                  "RSI: [6, 12, 24], BIAS: [6, 12, 24], BRAR: [26], VR: [24, 30], " +
                  "WR: [6, 10, 14], MTM: [6, 10], CCI: [13], DMI: [14, 6], " +
                  "CR: [26, 10, 20, 40, 60], PSY: [12, 6], DMA: [10, 50, 10], " +
                  "TRIX: [12, 20], EMV: [14, 9], SAR: [2, 2, 20], AO: [5, 34], ROC: [12, 6], " +
                  "OBV: [30]. PVT and AVP have no parameters. " +
                  "Example: For MA with periods 120 and 240 on main pane, use: {name: 'MA', params: [120, 240], pane: 'main'}. " +
                  "Do NOT use: [{name: 'MA', params: [120]}, {name: 'MA', params: [240]}]."
                ),
              pane: z
                .enum(["main", "sub"])
                .optional()
                .describe("Pane type: 'main' for main chart (candle pane), 'sub' for sub chart (new pane). Default is 'main'. IMPORTANT: Each unique combination of indicator name and pane should appear only once in the array. Combine all parameter values for the same indicator and pane into a single object."),
            })
          )
          .optional()
          .describe(
            "Array of technical indicators with optional parameters and pane selection. " +
            "CRITICAL RULE: Each unique combination of indicator name and pane must appear only ONCE in the array. " +
            "If you need multiple parameter values for the same indicator (e.g., MA with periods 120 and 240), " +
            "combine all values into a single params array: {name: 'MA', params: [120, 240], pane: 'main'}. " +
            "Do NOT create multiple objects like [{name: 'MA', params: [120]}, {name: 'MA', params: [240]}]. " +
            "Supported indicators: MA, EMA, SMA, BOLL, SAR, BBI, MACD, KDJ, RSI, WR, CCI, DMI, TRIX, OBV, VOL, VR, CR, PSY, BRAR, DMA, MTM, EMV, AO, PVT, BIAS, ROC, AVP"
          ),
      },
      annotations: { readOnlyHint: true },
      _meta: widgetMeta(liveKlineWidget),
    },
    async ({ symbol, interval, market, chartType = "candle_solid", timezone, indicators = [], overlays = [] }) => {
      const sym = String(symbol || "").toUpperCase();
      // Default interval: 1d for stocks, 1m for crypto
      const isStock = market !== "spot" && market !== "futures";
      const iv = String(interval || (isStock ? "1d" : "1m"));
      // For stocks with 1m interval, use area chart
      const ct = (isStock && iv === "1m") ? "area" : (chartType || "candle_solid");
      
      // Fetch latest 150 klines for the model
      let klines: any[] = [];
      try {
        const historyUrl = `${baseURL}/api/kline/history?symbol=${encodeURIComponent(sym)}&interval=${encodeURIComponent(iv)}&market=${encodeURIComponent(market)}&limit=150`;
        const res = await fetch(historyUrl);
        if (res.ok) {
          const data = await res.json();
          klines = (data.data || []).map((k: any) => ({
            ...k,
            timestamp: new Date(k.timestamp).toISOString(),
          }));
        }
      } catch (err) {
        // Silently fail, klines will be empty
      }
      
      return {
        content: [
          {
            type: "text",
            text: `Streaming ${sym} (${iv}) on ${market} with ${ct} chart type. Latest ${klines.length} klines loaded.`,
          },
        ],
        structuredContent: {
          symbol: sym,
          interval: iv,
          market,
          chartType: ct,
          timezone: timezone || undefined,
          indicators: indicators || [],
          overlays: overlays || [],
          klines: klines.slice(-150), // Ensure max 150
          timestamp: new Date().toISOString(),
        },
        _meta: widgetMeta(liveKlineWidget),
      };
    }
  );
});

export const GET = handler;
export const POST = handler;
