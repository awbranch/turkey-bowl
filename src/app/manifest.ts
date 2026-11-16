import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Turkey Bowl",
    short_name: "Turkey Bowl",
    start_url: "/",
    display: "standalone",
    background_color: "#fdf6ec",
    theme_color: "#9f1d35",
  };
}
