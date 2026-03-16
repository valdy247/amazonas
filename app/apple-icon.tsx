import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(135deg, #ff8a5b 0%, #ff6b35 52%, #dc4f1f 100%)",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "rgba(255,255,255,0.18)",
            border: "5px solid rgba(255,255,255,0.42)",
            borderRadius: "42px",
            color: "white",
            display: "flex",
            fontFamily: "sans-serif",
            fontSize: 56,
            fontWeight: 800,
            height: 126,
            justifyContent: "center",
            letterSpacing: "-0.06em",
            width: 126,
          }}
        >
          AR
        </div>
      </div>
    ),
    size
  );
}
