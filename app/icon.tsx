import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
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
            border: "10px solid rgba(255,255,255,0.4)",
            borderRadius: "110px",
            color: "white",
            display: "flex",
            fontFamily: "sans-serif",
            fontSize: 164,
            fontWeight: 800,
            height: 360,
            justifyContent: "center",
            letterSpacing: "-0.06em",
            width: 360,
          }}
        >
          AR
        </div>
      </div>
    ),
    size
  );
}
