# Carbon Sans workspace fonts

Stylesheet: `/fonts/workspace/carbon-sans.css`

Use `font-family: "Carbon Sans", "Microsoft YaHei UI", "PingFang SC", sans-serif`.

Four locally hosted static weights: 400, 500, 600, 700. Renamed and subset from Noto Sans SC distributed by `@fontsource/noto-sans-sc@5.3.1`. The SIL Open Font License is preserved in `LICENSE-NotoSansSC.txt`; provenance, source-code hashes and font hashes are in `sources.json`.

The subset covers all production source Chinese text and ASCII. Characters not included, including user-entered new names and some mathematical/icon symbols, use the configured system font fallback through CSS unicode ranges. No remote font request is made at runtime.
