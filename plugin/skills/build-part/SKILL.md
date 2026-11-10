---
name: build-part
description: Build or change a parametric CAD part or assembly with Turnery - enclosures, cases, brackets, mounts, stands, jigs, parts with screw holes, anything to 3D print or machine from stated dimensions. Use when the user says "build / model / design a part", "make an enclosure for this board", "a bracket with M3 holes", "export STEP / STL", or in Chinese 建一个外壳 / 做个零件 / 做个支架 / 做个盒子 / 画个底座 / 3D 打印一个…… / 用 turnery 建模 / 改一下壁厚 / 看一下备注.
---

# Build a part with Turnery

Turnery is a desktop app; its MCP server (`turnery`, tools named `mcp__plugin_turnery_turnery__*`) edits a feature tree stored as `*.turnery.json` and an OpenCascade kernel computes the geometry. The user watches every step in the Turnery window.

1. **Read the guide first.** Call `guide` once per session. It is the reference for coordinates, selectors and each feature; the tool descriptions assume you have read it. The guide and the tool results are in Chinese; answer the user in their language.
2. **Say what you are about to build** in one or two sentences before the first tool call: what it is, which parts, single file or assembly. Ask when the object or a dimension is unclear.
3. **Parameters first.** `open_part` (with `create: true` for a new file), then `set_params` for every key dimension, then features that refer to the parameter names. Give each feature a `name` and an `intent`.
4. **Read every result.** `✗` means fix that feature with `edit_feature`; do not stack a new feature on top. `⚠` must be handled or explained.
5. **Check, don't claim.** When the request has numbers, call `check` with one item per number, quoting the user's words in `said` and writing the number they gave as the expected value. Then `look` at the result. Use `measure` for distances; do not compute them yourself.
6. **The user points, you read.** Notes the user pins on faces arrive through `get_notes`; answer each with `resolve_note`. When you cannot tell which face they mean, call `request_pick`.
7. **Deliver** with `export` (`step`, `stl`, `py`, `json`, `bom`).

If the `turnery` server failed to connect, Turnery.app is not installed or has never been opened: point the user to https://github.com/linjiejim/turnery/releases/latest and have them reconnect with `/mcp`.
