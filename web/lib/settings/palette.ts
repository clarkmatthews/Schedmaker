export const COLOR_SWATCHES = [
  "48B7AB",
  "3A9A90",
  "2D6A4F",
  "8BBF3F",
  "C4D63C",
  "E07A3D",
  "D94F2B",
  "E03D6A",
  "C2185B",
  "744FC6",
  "5B3FA8",
  "3D7DE0",
  "1D4ED8",
  "0E7490",
  "0891B2",
  "78716C",
  "5B5B5B",
  "1F2937",
  "B45309",
  "92400E",
] as const;

export type SwatchColor = (typeof COLOR_SWATCHES)[number];
