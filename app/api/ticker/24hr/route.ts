import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const symbol = (searchParams.get("symbol") || "").toUpperCase();
	const market = ((searchParams.get("market") || "futures") as string).toLowerCase();

	if (!symbol) {
		return new Response("Missing symbol", { status: 400 });
	}

	try {
		let url: string;
		
		if (market === "spot") {
			url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;
		} else {
			// USDT-M futures
			url = `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`;
		}

		const response = await fetch(url);
		
		if (!response.ok) {
			throw new Error(`Binance API error: ${response.status}`);
		}
		
		const ticker = await response.json();
		
		return Response.json({
			price: Number(ticker.lastPrice || 0),
			priceChangePercent: Number(ticker.priceChangePercent || 0) / 100,
		});
	} catch (err) {
		return new Response(JSON.stringify({ error: String(err) }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}

