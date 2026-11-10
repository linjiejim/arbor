"""Bake every model into the web app.

  python -m turnerybake            # all models
  python -m turnerybake mug brick  # some

For a part, every combination of the sandbox parameters (``Param.values``)
is built feature by feature. Each combination becomes one GLB holding all
steps; faces carry their status (kept / modified / new) and the feature that
created them. Combinations that fail, or that pass the kernel but produce
nonsense, are recorded with the feature where they broke, so the site can
explain the failure instead of hiding it.

Output: app/public/models/<id>/{manifest.json, <variant>.glb} and
app/public/models/index.json.
"""

from __future__ import annotations

import hashlib
import importlib
import inspect
import itertools
import json
import sys
import textwrap
import time
import traceback
from dataclasses import asdict
from pathlib import Path

from .classify import FaceTracker, edges
from .glb import GLB
from .model import AssemblyModel, FeatureFailed, PartModel, Recorder

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "app" / "public" / "models"
MODELS_DIR = ROOT / "models"


def discover() -> list[str]:
    names = []
    for sub in ("parts", "assemblies"):
        for f in sorted((MODELS_DIR / sub).glob("*.py")):
            if not f.name.startswith("_"):
                names.append(f"{sub}.{f.stem}")
    return names


def variant_key(values: dict[str, float]) -> str:
    return "_".join(f"{k}-{_num(v)}" for k, v in sorted(values.items())) or "default"


def _num(v: float) -> str:
    return f"{v:g}"


def step_snippets(module) -> dict[str, str]:
    """Source of build() split at `# @step <id>` markers, minus recorder calls."""
    src = inspect.getsource(module.build).splitlines()
    out: dict[str, list[str]] = {}
    cur: str | None = None
    skip_depth = 0
    for line in src[1:]:
        s = line.strip()
        if s.startswith("# @step"):
            cur = s.split()[-1]
            out[cur] = []
            continue
        if cur is None:
            continue
        if skip_depth > 0:
            skip_depth += line.count("(") + line.count("[") - line.count(")") - line.count("]")
            continue
        top_return = s.startswith("return") and (len(line) - len(line.lstrip())) <= 4
        if s.startswith("r.") or top_return or s.endswith("# hide"):
            skip_depth = line.count("(") + line.count("[") - line.count(")") - line.count("]")
            continue
        out[cur].append(line)
    return {k: textwrap.dedent("\n".join(v)).strip() for k, v in out.items()}


def summaries(model: PartModel, values: dict) -> dict[str, str]:
    """Feature summaries for one parameter set; a summary may be a template or a function of params."""
    out = {}
    for f in model.features:
        if callable(f.summary):
            out[f.id] = f.summary(values)
        elif f.summary:
            try:
                out[f.id] = f.summary.format(**values)
            except (KeyError, IndexError, ValueError):
                out[f.id] = f.summary
    return out


def bake_part(module, model: PartModel) -> dict:
    out = OUT / model.id
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.glb"):
        old.unlink()
    defaults = {p.id: p.default for p in model.params}
    grid = [p for p in model.params if p.values]
    combos = list(itertools.product(*[p.values for p in grid])) or [()]
    variants: dict[str, dict] = {}
    snippets = step_snippets(module)
    t0 = time.time()
    for combo in combos:
        values = dict(defaults)
        values.update({p.id: v for p, v in zip(grid, combo)})
        key = variant_key({p.id: values[p.id] for p in grid})
        r = Recorder(model)
        try:
            module.build(dict(values), r)
            if len(r.steps) != len(model.features):
                raise FeatureFailed(model.features[len(r.steps)].id, "这一步没有生成结果")
            if model.check:
                problem = model.check(values, r.steps[-1].shape)
                if problem:
                    feat, msg = problem
                    raise FeatureFailed(feat, msg)
        except FeatureFailed as e:
            variants[key] = {"ok": False, "values": values, "failedAt": e.feature, "reason": e.message}
        except Exception as e:  # the kernel's own error: "command not done" and friends
            feat = model.features[min(len(r.steps), len(model.features) - 1)].id
            msg = str(e).splitlines()[0][:160] if str(e) else type(e).__name__
            variants[key] = {"ok": False, "values": values, "failedAt": feat, "reason": msg}
        if key in variants:
            # Keep the steps that did succeed: the site shows the part up to the failing feature.
            done = [s for s in r.steps if s.feature != variants[key]["failedAt"]]
            if done and done[-1].shape is not None:
                r.steps = done
                size, stats = write_part_glb(out / f"{key}.glb", model, r)
                variants[key].update({"file": f"{key}.glb", "bytes": size, "steps": len(done)})
            continue
        size, stats = write_part_glb(out / f"{key}.glb", model, r)
        variants[key] = {"ok": True, "values": values, "file": f"{key}.glb", "bytes": size, "steps": len(r.steps), "summaries": summaries(model, values), **stats}
    default_key = variant_key({p.id: p.default for p in grid})
    manifest = {
        "kind": "part",
        "id": model.id,
        "title": model.title,
        "subtitle": model.subtitle,
        "level": model.level,
        "teaches": model.teaches,
        "params": [asdict(p) for p in model.params],
        "features": [
            {
                "id": f.id,
                "op": f.op,
                "name": f.name,
                "title": f.title,
                "why": f.why,
                "summary": summaries(model, defaults).get(f.id, ""),
                "summaryTemplate": f.summary if isinstance(f.summary, str) else "",
                "pitfall": f.pitfall,
                "view": list(f.view),
                "focus": [list(c) for c in f.focus(defaults)] if f.focus else None,
                "code": snippets.get(f.id, ""),
            }
            for f in model.features
        ],
        "failures": model.failures,
        "defaultVariant": default_key,
        "variants": variants,
        "source": f"models/{module.__name__.replace('.', '/')}.py",
    }
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    ok = sum(1 for v in variants.values() if v["ok"])
    print(f"  {model.id}: {ok}/{len(variants)} variants ok in {time.time() - t0:.1f}s")
    if default_key not in variants or not variants[default_key]["ok"]:
        raise SystemExit(f"default variant of {model.id} failed: {variants.get(default_key)}")
    return manifest


def write_part_glb(path: Path, model: PartModel, r: Recorder) -> tuple[int, dict]:
    g = GLB()
    tracker = FaceTracker()
    mesh_cache: dict[str, int] = {}
    roots = []
    tri_total = 0
    for i, step in enumerate(r.steps):
        feature = model.features[i]
        children: list[int] = []
        is_sketch = bool(step.sketch) or step.plane is not None
        faces = tracker.same() if is_sketch else tracker.step(step.shape, feature.id)
        for f in faces:
            extras = {"kind": "face", "id": f.id, "status": f.status, "origin": f.origin, "modifiedBy": f.modified_by, "geom": f.geom}
            key = hashlib.sha1(json.dumps([f.positions, f.indices]).encode()).hexdigest()
            if key in mesh_cache:
                n = g.node(f"face{f.id}", extras)
                g.nodes[n]["mesh"] = mesh_cache[key]
            else:
                n = g.triangles(f"face{f.id}", f.positions, f.indices, extras)
                if n is None:
                    continue
                mesh_cache[key] = g.nodes[n]["mesh"]
                tri_total += len(f.indices) // 3
            children.append(n)
        e = edges(step.shape)
        for kind, segs in (("sharp", e.sharp), ("soft", e.soft)):
            ek = hashlib.sha1(json.dumps(segs).encode()).hexdigest()
            if not segs:
                continue
            if ek in mesh_cache:
                n = g.node(f"edges-{kind}", {"kind": "edges", "soft": kind == "soft"})
                g.nodes[n]["mesh"] = mesh_cache[ek]
            else:
                n = g.lines(f"edges-{kind}", segs, {"kind": "edges", "soft": kind == "soft"})
                mesh_cache[ek] = g.nodes[n]["mesh"]
            children.append(n)
        for kind, polys in (("sketch", step.sketch), ("construction", step.construction)):
            segs = [c for poly in polys for a, b in zip(poly, poly[1:]) for c in (*a, *b)]
            n = g.lines(kind, segs, {"kind": kind})
            if n is not None:
                children.append(n)
        if step.plane:
            children.append(g.node("plane", {"kind": "plane", **step.plane}))
        for d in step.dims:
            children.append(g.node("dim", {"kind": "dim", **asdict(d)}))
        roots.append(g.node(f"step:{feature.id}", {"kind": "step", "feature": feature.id, "index": i}, children))
    final = next(s.shape for s in reversed(r.steps) if s.shape is not None)
    bb = final.bounding_box()
    stats = {
        "triangles": tri_total,
        "volume": round(final.volume, 2),
        "bbox": [[round(bb.min.X, 2), round(bb.min.Y, 2), round(bb.min.Z, 2)], [round(bb.max.X, 2), round(bb.max.Y, 2), round(bb.max.Z, 2)]],
    }
    size = g.save(str(path), roots, {"model": model.id})
    return size, stats


def bake_assembly(module, model: AssemblyModel) -> dict:
    out = OUT / model.id
    out.mkdir(parents=True, exist_ok=True)
    shapes = module.build()
    g = GLB()
    roots = []
    for part in model.parts:
        shape = shapes[part.id]
        children = []
        for i, f in enumerate(shape.faces()):
            bf = FaceTracker._tessellate(f)
            n = g.triangles(f"{part.id}-face{i}", bf.positions, bf.indices, {"kind": "face", "id": i, "status": "kept", "origin": part.id, "geom": bf.geom})
            if n is not None:
                children.append(n)
        e = edges(shape)
        for kind, segs in (("sharp", e.sharp), ("soft", e.soft)):
            n = g.lines(f"{part.id}-edges-{kind}", segs, {"kind": "edges", "soft": kind == "soft"})
            if n is not None:
                children.append(n)
        bb = shape.bounding_box()
        roots.append(
            g.node(
                f"part:{part.id}",
                {"kind": "part", "part": part.id, "bbox": [[bb.min.X, bb.min.Y, bb.min.Z], [bb.max.X, bb.max.Y, bb.max.Z]]},
                children,
            )
        )
    size = g.save(str(out / "assembly.glb"), roots, {"model": model.id})
    manifest = {
        "kind": "assembly",
        "id": model.id,
        "title": model.title,
        "subtitle": model.subtitle,
        "level": model.level,
        "teaches": model.teaches,
        "parts": [asdict(p) for p in model.parts],
        "notes": model.notes,
        "file": "assembly.glb",
        "bytes": size,
        "source": f"models/{module.__name__.replace('.', '/')}.py",
    }
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    print(f"  {model.id}: assembly, {len(model.parts)} parts, {size / 1024:.0f} KB")
    return manifest


def main(argv: list[str]) -> None:
    sys.path.insert(0, str(MODELS_DIR))
    names = discover()
    wanted = set(argv)
    index = json.loads((OUT / "index.json").read_text()) if (OUT / "index.json").exists() else {}
    for name in names:
        module = importlib.import_module(name)
        model = module.MODEL
        if wanted and model.id not in wanted:
            continue
        print(f"baking {model.id} ({name})")
        try:
            m = bake_assembly(module, model) if isinstance(model, AssemblyModel) else bake_part(module, model)
        except SystemExit:
            raise
        except Exception:
            traceback.print_exc()
            raise SystemExit(f"bake failed: {model.id}")
        index[model.id] = {
            k: m[k] for k in ("kind", "id", "title", "subtitle", "level", "teaches")
        } | ({"features": len(m["features"])} if m["kind"] == "part" else {"parts": len(m["parts"])})
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(sys.argv[1:])
