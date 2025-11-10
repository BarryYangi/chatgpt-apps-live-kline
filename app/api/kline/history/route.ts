import type { NextRequest } from "next/server";
import Binance from "node-binance-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INTERVALS = new Set([
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
]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "").toUpperCase();
  const interval = (searchParams.get("interval") || "1m").toString();
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 100), 50), 1000);
  const market = ((searchParams.get("market") || "futures") as string).toLowerCase();
  const endTime = searchParams.get("endTime");

  if (!symbol) {
    return new Response("Missing symbol", { status: 400 });
  }
  if (!INTERVALS.has(interval)) {
    return new Response("Invalid interval", { status: 400 });
  }

  try {
    const binance = new (Binance as any)();
    let data: any[] = [];

    if (market === "spot") {
      const options: any = { limit };
      if (endTime) {
        options.endTime = Number(endTime);
      }
      const ticks = await new Promise<any[]>((resolve, reject) => {
        (binance as any).candlesticks(
          symbol,
          interval,
          (error: any, result: any[]) => {
            if (error) {
              reject(error);
              return;
            }
            resolve(result || []);
          },
          options
        );
      });
      // Binance returns data from oldest to newest, which is what we need for applyMoreData
      data = (ticks || []).map((t) => ({
        timestamp: Number(t[0]),
        open: Number(t[1]),
        high: Number(t[2]),
        low: Number(t[3]),
        close: Number(t[4]),
        volume: Number(t[5]),
      }));
    } else {
      // USDT-M futures
      const options: any = { limit };
      if (endTime) {
        options.endTime = Number(endTime);
      }
      const candles = await (binance as any).futuresCandlesticks(symbol, interval, options);
      // Binance returns data from oldest to newest, which is what we need for applyMoreData
      data = (candles || []).map((c: any) => ({
        timestamp: Number(c.openTime),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume),
      }));
    }

    return Response.json({ data });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

