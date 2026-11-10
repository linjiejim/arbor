"""A minimal glTF 2.0 binary (GLB) writer: triangle meshes, line sets and
empty nodes, each carrying ``extras`` (which three.js exposes as userData).
No materials: the site colours geometry from its own theme.
"""

from __future__ import annotations

import json
import struct
from typing import Any


class GLB:
    def __init__(self) -> None:
        self.buffer = bytearray()
        self.views: list[dict] = []
        self.accessors: list[dict] = []
        self.meshes: list[dict] = []
        self.nodes: list[dict] = []

    def _view(self, data: bytes, target: int | None) -> int:
        while len(self.buffer) % 4:
            self.buffer.append(0)
        view = {"buffer": 0, "byteOffset": len(self.buffer), "byteLength": len(data)}
        if target:
            view["target"] = target
        self.buffer.extend(data)
        self.views.append(view)
        return len(self.views) - 1

    def _positions(self, flat: list[float]) -> int:
        data = struct.pack(f"<{len(flat)}f", *flat)
        xs, ys, zs = flat[0::3], flat[1::3], flat[2::3]
        self.accessors.append(
            {
                "bufferView": self._view(data, 34962),
                "componentType": 5126,
                "count": len(flat) // 3,
                "type": "VEC3",
                "min": [min(xs), min(ys), min(zs)],
                "max": [max(xs), max(ys), max(zs)],
            }
        )
        return len(self.accessors) - 1

    def _indices(self, idx: list[int], vertex_count: int) -> int:
        if vertex_count < 65536:
            data, ctype = struct.pack(f"<{len(idx)}H", *idx), 5123
        else:
            data, ctype = struct.pack(f"<{len(idx)}I", *idx), 5125
        self.accessors.append({"bufferView": self._view(data, 34963), "componentType": ctype, "count": len(idx), "type": "SCALAR"})
        return len(self.accessors) - 1

    def node(self, name: str, extras: dict[str, Any] | None = None, children: list[int] | None = None) -> int:
        n: dict[str, Any] = {"name": name}
        if extras:
            n["extras"] = extras
        if children:
            n["children"] = children
        self.nodes.append(n)
        return len(self.nodes) - 1

    def triangles(self, name: str, positions: list[float], indices: list[int], extras: dict[str, Any]) -> int | None:
        if not positions or not indices:
            return None
        prim = {"attributes": {"POSITION": self._positions(positions)}, "indices": self._indices(indices, len(positions) // 3), "mode": 4}
        self.meshes.append({"primitives": [prim]})
        n = self.node(name, extras)
        self.nodes[n]["mesh"] = len(self.meshes) - 1
        return n

    def lines(self, name: str, segments: list[float], extras: dict[str, Any]) -> int | None:
        """Pairs of points (LINES mode)."""
        if not segments:
            return None
        prim = {"attributes": {"POSITION": self._positions(segments)}, "mode": 1}
        self.meshes.append({"primitives": [prim]})
        n = self.node(name, extras)
        self.nodes[n]["mesh"] = len(self.meshes) - 1
        return n

    def save(self, path: str, roots: list[int], asset_extras: dict[str, Any] | None = None) -> int:
        doc: dict[str, Any] = {
            "asset": {"version": "2.0", "generator": "turnery turnerybake"},
            "scene": 0,
            "scenes": [{"nodes": roots}],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "accessors": self.accessors,
            "bufferViews": self.views,
            "buffers": [{"byteLength": len(self.buffer)}],
        }
        if asset_extras:
            doc["asset"]["extras"] = asset_extras
        js = json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        js += b" " * ((4 - len(js) % 4) % 4)
        while len(self.buffer) % 4:
            self.buffer.append(0)
        total = 12 + 8 + len(js) + 8 + len(self.buffer)
        with open(path, "wb") as f:
            f.write(struct.pack("<III", 0x46546C67, 2, total))
            f.write(struct.pack("<II", len(js), 0x4E4F534A))
            f.write(js)
            f.write(struct.pack("<II", len(self.buffer), 0x004E4942))
            f.write(self.buffer)
        return total
