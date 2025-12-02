import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STOCK_API_BASE = process.env.STOCK_API_BASE!;

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
  const market = (searchParams.get("market") || "futures") as string;
  const endTime = searchParams.get("endTime");

  if (!symbol) {
    return new Response("Missing symbol", { status: 400 });
  }
  if (!INTERVALS.has(interval)) {
    return new Response("Invalid interval", { status: 400 });
  }

  // 检测是否是股票市场
  const isStock = market.toLowerCase() !== "spot" && market.toLowerCase() !== "futures";

  if (isStock) {
    try {
      const params = new URLSearchParams({
        symbol,
        interval,
        market,
        limit: limit.toString(),
      });

      if (endTime) {
        params.append("endTime", endTime);
      }

      const url = `${STOCK_API_BASE}/api/kline/history?${params}`;
      
      const response = await fetch(url, {
        headers: {
          "X-APP-NAME": "global",
        },
      });

      if (!response.ok) {
        throw new Error(`Stock API error: ${response.status}`);
      }

      const klines = await response.json();
      
      const data = (klines || []).map((k: any) => ({
        timestamp: Number(k.timestamp),
        open: Number(k.open),
        high: Number(k.high),
        low: Number(k.low),
        close: Number(k.close),
        volume: Number(k.volume),
      }));

      return Response.json({ data });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  try {
    let url: string;
    const params = new URLSearchParams({
      symbol,
      interval,
      limit: limit.toString(),
    });
    
    if (endTime) {
      params.append('endTime', endTime);
    }

    if (market === "spot") {
      url = `https://api.binance.com/api/v3/klines?${params}`;
    } else {
      // USDT-M futures
      url = `https://fapi.binance.com/fapi/v1/klines?${params}`;
    }

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }
    
    const candles = await response.json();
    
    // Binance returns data from oldest to newest, which is what we need for applyMoreData
    const data = (candles || []).map((c: any) => ({
      timestamp: Number(c[0]),
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5]),
    }));

    return Response.json({ data });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

