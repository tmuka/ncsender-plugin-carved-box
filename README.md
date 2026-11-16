# Carved Box

An [ncSender](https://github.com/siganberg/ncSender) plugin that carves a round box with a lid out of one board. The base and the lid are cut side by side: each is pocketed down to its wall, floor and top, a lip on one half slides into the other with the clearance you set, and both outlines are cut free with holding tabs. One bit, one program.

## Settings

- **Box:** the outside **Diameter**, your measured **Stock Thickness** (each half is the full thickness), the **Wall**, the base's **Floor** and the lid's **Top**.
- **Fit:** which half the **Lip** is on, its **Height** and **Width** (the inner part of the wall), and the **Clearance** each side: about 0.2–0.3 mm in wood (it moves with the weather), 0.1 mm in plastic. The other half's opening is widened by the Lip Width plus the Clearance, Lip Height plus the Clearance deep, so the halves meet on the shoulder outside the lip.
- **Layout:** the halves side by side **Along X** or **Along Y**, the **Gap** of wood left between them and the **Margin** to the stock's edges; the origin (X0 Y0) at the stock's **front-left corner** or the **middle of the pair**. Z0 is the top of the stock. The stock needed is shown.
- **Holding Tabs:** count, width and height on each outline.
- **Tool & Feeds:** a bit from ncSender's Tool Library (with a tool changer, the program starts with `M6 T`) or a typed size, and starting feeds from the bit, its flutes and the material, as QuickCut's.

The previews show both halves on the stock, and the closed box cut through its middle: the lip in the other half's opening, the clearance drawn a little wider to be seen, the closed and inside heights.

## What it cuts

1. Each half's inside: a helix down in the middle, rings out to the wall, a pass at a time; the widened opening for the lip first on the half without it; the shoulder round the lip (a ramp along its ring, rings out past the outline) on the half with it.
2. Both outlines last, so the board stays stiff: a helical ramp, through the stock and 0.5 mm into the spoilboard, lifting over each tab on the last passes.

Put the side of the board you want on the outside of the lid face down: the lid's top is the board's underside.

## License

GPL-3.0. The starting feeds are QuickCut's (siganberg/ncsender-plugin-quickcut), copied by `npm run sync-quickcut`.
