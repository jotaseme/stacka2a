import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Basic URL validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Only allow HTTP(S)
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: "Only HTTP/HTTPS URLs are supported" },
        { status: 400 }
      );
    }

    // Fetch the agent card
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "StackA2A-Discovery/1.0",
        },
      });

      clearTimeout(timeout);

      if (!resp.ok) {
        return NextResponse.json(
          { error: `Agent returned HTTP ${resp.status}` },
          { status: 502 }
        );
      }

      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("json")) {
        return NextResponse.json(
          { error: `Expected JSON but got ${contentType}` },
          { status: 502 }
        );
      }

      const data = await resp.json();
      return NextResponse.json(data);
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof DOMException && err.name === "AbortError") {
        return NextResponse.json(
          { error: "Request timed out (10s)" },
          { status: 504 }
        );
      }
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Failed to fetch agent card",
        },
        { status: 502 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
