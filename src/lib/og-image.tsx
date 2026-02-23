import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

export function createOgImage({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#ffffff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {badge && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                backgroundColor: "rgba(37,99,235,0.1)",
                color: "#2563eb",
                fontSize: "20px",
                fontWeight: 600,
                padding: "6px 16px",
                borderRadius: "999px",
              }}
            >
              {badge}
            </div>
          </div>
        )}
        <div
          style={{
            fontSize: title.length > 50 ? "48px" : "56px",
            fontWeight: 800,
            color: "#0f172a",
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
            maxWidth: "900px",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: "24px",
              color: "#64748b",
              marginTop: "20px",
              lineHeight: 1.5,
              maxWidth: "800px",
            }}
          >
            {subtitle}
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: "auto",
            gap: "12px",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Stack
          </div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "#2563eb",
            }}
          >
            A2A
          </div>
          <div
            style={{
              fontSize: "20px",
              color: "#64748b",
              marginLeft: "8px",
            }}
          >
            stacka2a.com
          </div>
        </div>
      </div>
    ),
    { ...ogSize }
  );
}
