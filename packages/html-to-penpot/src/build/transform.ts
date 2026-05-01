/**
 * Parse the `transform` value returned by `getComputedStyle`. The browser
 * canonicalises every CSS transform shorthand (`rotate(...)`, `scale(...)`,
 * `translate(...)`, etc.) into a 2D `matrix(a, b, c, d, e, f)` (or `matrix3d`
 * for 3D), so we only need to read those two forms.
 *
 * Penpot stores rotation as a separate `rotation` field with the OPPOSITE
 * sign of CSS — see `combinedTransformStyle` in the converter:
 *   CSS  rotate(-rotation deg)   ⇐   shape.rotation
 *
 * For v1 we only honour pure 2D rotation around the element's geometric
 * centre (CSS default `transform-origin: 50% 50%`). Translation is already
 * captured by `getBoundingClientRect`, so we ignore the `e/f` matrix entries.
 * Scale and skew are reported via a warning and otherwise dropped.
 */

export interface ParsedTransform {
  /** Penpot-convention rotation in degrees (sign-flipped from CSS). */
  rotationDeg: number;
  /** True when the matrix has a non-1 scale or non-zero skew we did not honour. */
  hasUnsupportedComponent: boolean;
}

const NUM = /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/.source;

function nearlyEquals(a: number, b: number, epsilon = 1e-3): boolean {
  return Math.abs(a - b) < epsilon;
}

/**
 * Returns null when the transform is `none` / empty / unparseable, indicating
 * the caller should keep identity. Non-null result always carries a rotation
 * (possibly 0) plus a flag for unsupported components.
 */
export function parseCssTransform(value: string): ParsedTransform | null {
  if (!value || value === 'none') return null;
  const trimmed = value.trim();

  // matrix3d(...) — pull a, b, c, d from the 4×4. Rotation around Z is in the
  // top-left 2×2 block (positions 0, 1, 4, 5) when there's no Z rotation.
  const m3d = trimmed.match(
    new RegExp(`^matrix3d\\(\\s*(${NUM})(?:\\s*,\\s*(${NUM})){15}\\s*\\)$`),
  );
  if (m3d) {
    const parts = trimmed
      .slice('matrix3d('.length, -1)
      .split(',')
      .map((s) => Number(s.trim()));
    if (parts.length === 16 && parts.every(Number.isFinite)) {
      const [a, b, , , c, d] = parts;
      return parseMatrixComponents(a!, b!, c!, d!);
    }
    return null;
  }

  const m2d = trimmed.match(
    new RegExp(
      `^matrix\\(\\s*(${NUM})\\s*,\\s*(${NUM})\\s*,\\s*(${NUM})\\s*,\\s*(${NUM})\\s*,\\s*(${NUM})\\s*,\\s*(${NUM})\\s*\\)$`,
    ),
  );
  if (m2d) {
    const a = Number(m2d[1]);
    const b = Number(m2d[2]);
    const c = Number(m2d[3]);
    const d = Number(m2d[4]);
    return parseMatrixComponents(a, b, c, d);
  }

  return null;
}

function parseMatrixComponents(a: number, b: number, c: number, d: number): ParsedTransform {
  const cssAngleRad = Math.atan2(b, a);
  const cssAngleDeg = (cssAngleRad * 180) / Math.PI;

  // A pure rotation matrix is [cosθ, sinθ, -sinθ, cosθ]. Detect scale/skew by
  // checking that |a, b| ≈ |d, -c|.
  const scaleX = Math.hypot(a, b);
  const scaleY = Math.hypot(c, d);
  const skewX = a * c + b * d;

  const hasUnsupportedComponent =
    !nearlyEquals(scaleX, 1) || !nearlyEquals(scaleY, 1) || !nearlyEquals(skewX, 0);

  // Chrome canonicalises the matrix to ~6 decimal places, so atan2 round-trip
  // jitters by ~1e-6 (e.g. authored `-4deg` arrives as `-4.0000017deg`). Snap
  // to the nearest integer when the result is within 1e-3 — designers virtually
  // always author whole-degree rotations and the float drift only confuses
  // future round-trips. Keep 4 dp in the rare non-integer case.
  const css = -cssAngleDeg;
  const rounded = Math.round(css);
  const snapped =
    Math.abs(css - rounded) < 1e-3 ? rounded : Math.round(css * 10000) / 10000;

  return {
    rotationDeg: snapped,
    hasUnsupportedComponent,
  };
}
