"""Model definitions: parameters, features, and the recorder a build function
writes its steps into.

A part model is a plain Python module that defines ``MODEL`` (metadata) and
``build(p, r)``. ``build`` runs ordinary build123d code; after each feature
it calls ``r.solid(...)`` or ``r.sketch(...)`` so the baker can capture the
state of the part at that point of the feature tree.

The source between ``# @step <id>`` markers becomes the "代码" tab of that
feature on the site, so keep each step's code readable on its own.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

import build123d as bd


@dataclass
class Param:
    id: str
    label: str
    unit: str
    default: float
    #: Values baked for the parameter sandbox. Empty = fixed (shown read-only).
    values: list[float] = field(default_factory=list)
    #: Feature that owns the value ("影响：…" on the site).
    feature: str = ""


@dataclass
class Feature:
    id: str
    op: str
    name: str
    title: str
    why: str
    #: Template ("R{rb}") or a function of the params for derived values.
    summary: str | Callable[[dict], str] = ""
    pitfall: str = ""
    #: Key viewpoint: direction from the target towards the camera (Z up).
    view: tuple[float, float, float] = (1.0, -1.1, 0.85)
    #: Optional focus box (min xyz, max xyz) as a function of params.
    focus: Callable[[dict], tuple[tuple[float, float, float], tuple[float, float, float]]] | None = None


@dataclass
class PartModel:
    id: str
    title: str
    subtitle: str
    level: str
    teaches: list[str]
    params: list[Param]
    features: list[Feature]
    #: Plain-language explanation shown when a parameter combination fails at a feature.
    failures: dict[str, str] = field(default_factory=dict)
    #: Extra sanity checks on the finished part (catch silent kernel errors).
    check: Callable[[dict, bd.Shape], str | None] | None = None
    source: str = ""
    kind: str = "part"


@dataclass
class Part:
    id: str
    name: str
    qty: int
    material: str
    process: str
    role: str
    explode: tuple[float, float, float]
    order: int
    note: str
    #: A part model id with its own feature tree (drill-down on the site).
    model: str | None = None
    #: The degree of freedom this part keeps in the assembly, e.g.
    #: {"type": "revolute", "origin": [x, y, z], "axis": [1, 0, 0], "min": 0, "max": 110, "label": "开合角"}
    motion: dict | None = None


@dataclass
class AssemblyModel:
    id: str
    title: str
    subtitle: str
    level: str
    teaches: list[str]
    parts: list[Part]
    notes: list[str] = field(default_factory=list)
    kind: str = "assembly"


@dataclass
class Dim:
    """A linear dimension: from a to b, offset along ``dir`` by ``offset``."""

    a: tuple[float, float, float]
    b: tuple[float, float, float]
    dir: tuple[float, float, float]
    offset: float
    text: str


@dataclass
class Step:
    feature: str
    shape: bd.Shape | None
    #: Sketch overlay: polylines (lists of xyz points).
    sketch: list[list[tuple[float, float, float]]] = field(default_factory=list)
    construction: list[list[tuple[float, float, float]]] = field(default_factory=list)
    plane: dict[str, Any] | None = None
    dims: list[Dim] = field(default_factory=list)
    labels: list[dict[str, Any]] = field(default_factory=list)


class FeatureFailed(Exception):
    def __init__(self, feature: str, message: str):
        super().__init__(f"{feature}: {message}")
        self.feature = feature
        self.message = message


class Recorder:
    """Collects the part state after every feature."""

    def __init__(self, model: PartModel):
        self.model = model
        self.steps: list[Step] = []
        self._shape: bd.Shape | None = None

    def solid(self, feature: str, shape: bd.Shape) -> bd.Shape:
        if shape is None or not shape.is_valid:
            raise FeatureFailed(feature, "结果不是有效实体")
        vol = shape.volume
        if vol <= 1e-6:
            raise FeatureFailed(feature, "结果体积为零")
        self._shape = shape
        self.steps.append(Step(feature, shape))
        return shape

    def check(self, feature: str, ok: bool, message: str) -> None:
        """Catch silent kernel errors: a result that is valid but wrong."""
        if not ok:
            raise FeatureFailed(feature, message)

    def sketch(
        self,
        feature: str,
        geometry: bd.Shape | list[bd.Shape],
        plane: bd.Plane,
        size: float,
        plane_name: str = "",
        construction: list[bd.Shape] | None = None,
        dims: list[Dim] | None = None,
        center: tuple[float, float, float] | None = None,
    ) -> None:
        items = geometry if isinstance(geometry, list) else [geometry]
        lines = [poly for g in items for poly in _polylines(g)]
        cons = [poly for g in (construction or []) for poly in _polylines(g)]
        o = plane.origin if center is None else bd.Vector(*center)
        self.steps.append(
            Step(
                feature,
                self._shape,
                sketch=lines,
                construction=cons,
                plane={
                    "origin": _t(o),
                    "x": _t(plane.x_dir),
                    "normal": _t(plane.z_dir),
                    "size": size,
                    "name": plane_name,
                },
                dims=dims or [],
            )
        )


def _t(v: bd.Vector) -> tuple[float, float, float]:
    return (round(v.X, 4), round(v.Y, 4), round(v.Z, 4))


def _polylines(g: bd.Shape) -> list[list[tuple[float, float, float]]]:
    """Discretise every edge of a sketch (face, wire or edge) into polylines."""
    out = []
    for e in g.edges():
        n = 2 if e.geom_type == bd.GeomType.LINE else max(12, min(96, int(e.length / 1.5)))
        out.append([_t(e.position_at(i / (n - 1))) for i in range(n)])
    return out
