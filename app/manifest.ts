import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Verifyzon",
    short_name: "Verifyzon",
    description: "Verified collaboration platform for reviewers and providers",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f7f7f2",
    theme_color: "#ff6b35",
    orientation: "portrait",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
