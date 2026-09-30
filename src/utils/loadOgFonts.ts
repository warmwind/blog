import { Buffer } from "node:buffer";
import type { Font } from "satori";
import regular from "@/assets/fonts/ibm-plex-mono/IBMPlexMono-Regular.woff?inline";
import bold from "@/assets/fonts/ibm-plex-mono/IBMPlexMono-Bold.woff?inline";

import chineseRegular from "@/assets/fonts/ibm-plex-sans-sc/IBMPlexSansSC-Regular.woff?inline";
import chineseBold from "@/assets/fonts/ibm-plex-sans-sc/IBMPlexSansSC-Bold.woff?inline";

// Bundle the original font family so OG generation needs no network access.
// Plex Sans SC supplies glyphs missing from Mono, including Chinese titles.
// Keep the font objects stable so Satori can reuse its parsed-font cache.
const fonts: Font[] = [
  { name: "IBM Plex Mono", data: regular, weight: 400 },
  { name: "IBM Plex Mono", data: bold, weight: 700 },
  { name: "IBM Plex Sans SC", data: chineseRegular, weight: 400 },
  { name: "IBM Plex Sans SC", data: chineseBold, weight: 700 },
].map(({ name, data, weight }) => ({
  name,
  data: Buffer.from(data.split(",")[1], "base64"),
  weight: weight as 400 | 700,
  style: "normal",
}));

export default function loadOgFonts(): Font[] {
  return fonts;
}
