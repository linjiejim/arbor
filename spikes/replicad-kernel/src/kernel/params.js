// Parameter defaults / slider ranges / step labels (no kernel imports, safe for the main thread).
export const DEFAULT_PARAMS = {
  height: 95, // mm
  diameter: 82, // outer diameter, mm
  wall: 3.5, // shell thickness, mm
  bottomFillet: 6, // radius of the outside bottom edge, mm
  handleSize: 1, // scale of the handle loop (reach 26 mm x span 48 mm at 1.0)
  handleThickness: 10, // diameter of the handle's circular cross-section, mm
  junctionFillet: 2, // fillet where the handle meets the body, mm (0 = skip)
};

export const PARAM_RANGES = {
  height: [60, 140, 1],
  diameter: [50, 110, 1],
  wall: [1.5, 8, 0.5],
  bottomFillet: [0.5, 20, 0.5],
  handleSize: [0.6, 1.4, 0.05],
  handleThickness: [6, 16, 1],
  junctionFillet: [0, 5, 0.25],
};

export const STEP_LABELS = {
  sketch: "草图 Sketch",
  revolve: "旋转 Revolve",
  filletBottom: "底边圆角 Fillet",
  shell: "抽壳 Shell",
  sweep: "扫掠把手 Sweep",
  fuse: "合并 Fuse",
  filletJunction: "连接处圆角 Fillet",
};
