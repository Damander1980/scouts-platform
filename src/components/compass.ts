// The compass rose in our brand mark, on a 40x40 grid centred at (20,20). Shared by the site logo, the app
// icon and the link-preview image so they always match. Each point is two halves, dark and light, for depth;
// north is longer and solid navy so the mark reads as a compass at any size.
const C = 20;
const NAVY = "#12355F", DEEP = "#0C2442", LIGHT = "#FFFFFF", SHADE = "#E9E3D6";

type Seg = { d: string; fill: string };
const tri = (a: [number, number], b: [number, number], c: [number, number], fill: string): Seg =>
  ({ d: `M${a[0]} ${a[1]} L${b[0]} ${b[1]} L${c[0]} ${c[1]} Z`, fill });

export function compassRose(scale = 1): Seg[] {
  const r = (v: number) => C + (v - C) * scale;
  const p = (x: number, y: number): [number, number] => [r(x), r(y)];
  const c = p(C, C);
  const N = p(20, 5.6), S = p(20, 32.4), E = p(32.4, 20), W = p(7.6, 20);
  const NE = p(23.3, 16.7), SE = p(23.3, 23.3), SW = p(16.7, 23.3), NW = p(16.7, 16.7);
  // Smaller diagonal points behind the main star.
  const nd = p(28.4, 11.6), sd = p(28.4, 28.4), sw = p(11.6, 28.4), nw = p(11.6, 11.6);
  const tN = p(20, 17.6), tE = p(22.4, 20), tS = p(20, 22.4), tW = p(17.6, 20);
  return [
    tri(nd, tN, tE, SHADE), tri(sd, tE, tS, SHADE), tri(sw, tS, tW, SHADE), tri(nw, tW, tN, SHADE),
    tri(N, NW, c, NAVY), tri(N, NE, c, DEEP),
    tri(E, NE, c, LIGHT), tri(E, SE, c, SHADE),
    tri(S, SE, c, LIGHT), tri(S, SW, c, SHADE),
    tri(W, SW, c, LIGHT), tri(W, NW, c, SHADE),
  ];
}

/** Tick marks at the four cardinal points, just inside the stitched ring. */
export const compassTicks = ["M20 4.4V6.2", "M35.6 20H33.8", "M20 35.6V33.8", "M4.4 20H6.2"];
