// FORGE FOREVER: dmath.js (design pass 36, the Arena, build 27: the wire). Deterministic transcendental math for lockstep play.
// Two phones in a bout each run the whole fight and must get the same bits: +, -, x, / and Math.sqrt are correctly rounded by every
// JavaScript engine, but Math.sin, cos, tan, atan, atan2, exp, log, pow and hypot are not specified to the last bit and differ between
// V8 (Android Chrome) and JavaScriptCore (every iPhone browser). These are fdlibm's algorithms written in JavaScript from those
// correctly rounded primitives alone, so every engine gives the same double: DMath.install() puts them over Math on the arena page
// (and only there: the cellar's and the levels' pins keep the native functions). Accuracy is fdlibm's (under 1 ulp for sin, cos, atan,
// atan2, exp and log on ordinary arguments; tan as the quotient of the reduced sine and cosine, pow as exp(y log x), a few ulp).
// Argument reduction for sin and cos is fdlibm's three-step Cody-Waite, exact to |x| < 2^19 pi/2 and still deterministic beyond it
// (a bout's angles never leave [-2 pi, 2 pi]).
//
//   DMath.sin, cos, tan, atan, atan2, exp, log, pow, hypot    the functions, usable on their own
//   DMath.install()                       Math.* replaced (idempotent); DMath.installed; DMath.uninstall() puts the natives back
//   DMath.native                          the engine's own functions, kept
//   DMath.selfTest()                      a 32-bit checksum of pinned values: tools/test-dmath.js pins it in node, the harness repeats it in Chrome
// Plain script, defines window.DMath (module.exports in node). Pure: no state but the install flag.
(function (root) {
  "use strict";
  const F64 = new Float64Array(1), U32 = new Uint32Array(F64.buffer);
  const HI = (() => { F64[0] = 1; return U32[1] === 0x3ff00000 ? 1 : 0; })(), LO = 1 - HI;
  const hi = x => { F64[0] = x; return U32[HI] | 0; };
  const lo = x => { F64[0] = x; return U32[LO] >>> 0; };
  const words = (h, l) => { U32[HI] = h >>> 0; U32[LO] = l >>> 0; return F64[0]; };
  const setHi = (x, h) => { F64[0] = x; U32[HI] = h >>> 0; return F64[0]; };
  const sqrt = Math.sqrt, abs = Math.abs, floor = Math.floor;
  // 2^k for an integer k (two steps keep it inside the normal range)
  function scalbn(x, k) {
    if (k > 1023) { x *= words(0x7fe00000, 0); k -= 1023; if (k > 1023) { x *= words(0x7fe00000, 0); k -= 1023; if (k > 1023) k = 1023; } }
    else if (k < -1022) { x *= words(0x00100000, 0) * words(0x43500000, 0); k += 1022 - 54; if (k < -1022) { x *= words(0x00100000, 0) * words(0x43500000, 0); k += 1022 - 54; if (k < -1022) k = -1022; } }
    return x * words((0x3ff + k) << 20, 0);
  }

  // ------------------------------------------------------------------ sin and cos: fdlibm's kernels and its reduction
  const S1 = -1.66666666666666324348e-01, S2 = 8.33333333332248946124e-03, S3 = -1.98412698298579493134e-04, S4 = 2.75573137070700676789e-06, S5 = -2.50507602534068634195e-08, S6 = 1.58969099521155010221e-10;
  const C1 = 4.16666666666666019037e-02, C2 = -1.38888888888741095749e-03, C3 = 2.48015872894767294178e-05, C4 = -2.75573143513906633035e-07, C5 = 2.08757232129817482790e-09, C6 = -1.13596475577881948265e-11;
  function kernelSin(x, y, iy) {
    const ix = hi(x) & 0x7fffffff;
    if (ix < 0x3e400000) return x;   // |x| < 2^-27
    const z = x * x, v = z * x, r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
    if (iy === 0) return x + v * (S1 + z * r);
    return x - ((z * (0.5 * y - v * r) - y) - v * S1);
  }
  function kernelCos(x, y) {
    const ix = hi(x) & 0x7fffffff;
    if (ix < 0x3e400000) return 1.0;
    const z = x * x, r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
    if (ix < 0x3FD33333) return 1.0 - (0.5 * z - (z * r - x * y));   // |x| < 0.3
    const qx = ix > 0x3fe90000 ? 0.28125 : words(ix - 0x00200000, 0);
    const hz = 0.5 * z - qx, a = 1.0 - qx;
    return a - (hz - (z * r - x * y));
  }
  const invpio2 = 6.36619772367581382433e-01, pio2_1 = 1.57079632673412561417e+00, pio2_1t = 6.07710050650619224932e-11, pio2_2 = 6.07710050630396597660e-11,
    pio2_2t = 2.02226624879595063154e-21, pio2_3 = 2.02226624871116645580e-21, pio2_3t = 8.47842766036889956997e-32;
  const RED = [0, 0, 0];   // [n, y0, y1]
  // x reduced to [-pi/4, pi/4] as y0 + y1 with the quadrant n (fdlibm e_rem_pio2's medium path for every finite x)
  const TWO_PI = 6.283185307179586;
  function remPio2(x) {
    const hx = hi(x);
    let t = abs(x);
    if (t >= 1073741824) t = t % TWO_PI;   // |x| >= 2^30: the remainder by the double nearest 2 pi is exact and deterministic (and, for such x, as right as it needs to be)
    const ix = hi(t) & 0x7fffffff;
    let n = floor(t * invpio2 + 0.5), fn = n;
    let r = t - fn * pio2_1, w = fn * pio2_1t, y0 = r - w;
    const j = ix >> 20;
    let i = j - ((hi(y0) >> 20) & 0x7ff);
    if (i > 16) {
      let tt = r; w = fn * pio2_2; r = tt - w; w = fn * pio2_2t - ((tt - r) - w); y0 = r - w;
      i = j - ((hi(y0) >> 20) & 0x7ff);
      if (i > 49) { tt = r; w = fn * pio2_3; r = tt - w; w = fn * pio2_3t - ((tt - r) - w); y0 = r - w; }
    }
    let y1 = (r - y0) - w;
    if (hx < 0) { y0 = -y0; y1 = -y1; n = -n; }
    RED[0] = ((n % 4) + 4) % 4; RED[1] = y0; RED[2] = y1;
    return RED;
  }
  function sin(x) {
    const ix = hi(x) & 0x7fffffff;
    if (ix <= 0x3fe921fb) return kernelSin(x, 0, 0);
    if (ix >= 0x7ff00000) return NaN;
    const R = remPio2(x), n = R[0], y0 = R[1], y1 = R[2];
    return n === 0 ? kernelSin(y0, y1, 1) : n === 1 ? kernelCos(y0, y1) : n === 2 ? -kernelSin(y0, y1, 1) : -kernelCos(y0, y1);
  }
  function cos(x) {
    const ix = hi(x) & 0x7fffffff;
    if (ix <= 0x3fe921fb) return kernelCos(x, 0);
    if (ix >= 0x7ff00000) return NaN;
    const R = remPio2(x), n = R[0], y0 = R[1], y1 = R[2];
    return n === 0 ? kernelCos(y0, y1) : n === 1 ? -kernelSin(y0, y1, 1) : n === 2 ? -kernelCos(y0, y1) : kernelSin(y0, y1, 1);
  }
  function tan(x) {
    const ix = hi(x) & 0x7fffffff;
    if (ix <= 0x3fe921fb) return kernelSin(x, 0, 0) / kernelCos(x, 0);
    if (ix >= 0x7ff00000) return NaN;
    const R = remPio2(x), n = R[0], y0 = R[1], y1 = R[2], s = kernelSin(y0, y1, 1), c = kernelCos(y0, y1);
    return (n & 1) === 0 ? s / c : -c / s;
  }

  // ------------------------------------------------------------------ atan and atan2: fdlibm s_atan and e_atan2
  const atanhi = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00];
  const atanlo = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
  const aT = [3.33333333333329318027e-01, -1.99999999998764832476e-01, 1.42857142725034663711e-01, -1.11111104054623557880e-01, 9.09088713343650656196e-02,
    -7.69187620504482999495e-02, 6.66107313738753120669e-02, -5.83357013379057348645e-02, 4.97687799461593236017e-02, -3.65315727442169155270e-02, 1.62858201153657823623e-02];
  function atan(x) {
    const hx = hi(x), ix = hx & 0x7fffffff;
    if (ix >= 0x44100000) { if (ix > 0x7ff00000 || (ix === 0x7ff00000 && lo(x) !== 0)) return NaN; return hx > 0 ? atanhi[3] + atanlo[3] : -atanhi[3] - atanlo[3]; }
    let id;
    if (ix < 0x3fdc0000) { if (ix < 0x3e200000) return x; id = -1; }
    else {
      x = abs(x);
      if (ix < 0x3ff30000) { if (ix < 0x3fe60000) { id = 0; x = (2.0 * x - 1.0) / (2.0 + x); } else { id = 1; x = (x - 1.0) / (x + 1.0); } }
      else { if (ix < 0x40038000) { id = 2; x = (x - 1.5) / (1.0 + 1.5 * x); } else { id = 3; x = -1.0 / x; } }
    }
    const z = x * x, w = z * z;
    const s1 = z * (aT[0] + w * (aT[2] + w * (aT[4] + w * (aT[6] + w * (aT[8] + w * aT[10])))));
    const s2 = w * (aT[1] + w * (aT[3] + w * (aT[5] + w * (aT[7] + w * aT[9]))));
    if (id < 0) return x - x * (s1 + s2);
    const r = atanhi[id] - ((x * (s1 + s2) - atanlo[id]) - x);
    return hx < 0 ? -r : r;
  }
  const pi_o_4 = 7.8539816339744827900e-01, pi_o_2 = 1.5707963267948965580e+00, PI = 3.1415926535897931160e+00, pi_lo = 1.2246467991473531772e-16, tiny = 1.0e-300;
  function atan2(y, x) {
    const hx = hi(x), ix = hx & 0x7fffffff, lx = lo(x), hy = hi(y), iy = hy & 0x7fffffff, ly = lo(y);
    if ((ix | ((lx | -lx) >>> 31)) > 0x7ff00000 || (iy | ((ly | -ly) >>> 31)) > 0x7ff00000) return NaN;
    if (x === 1.0) return atan(y);
    const m = ((hy >> 31) & 1) | ((hx >> 30) & 2);
    if (y === 0) { if (m === 0 || m === 1) return y; if (m === 2) return PI + tiny; return -PI - tiny; }
    if (x === 0) return hy < 0 ? -pi_o_2 - tiny : pi_o_2 + tiny;
    if (ix === 0x7ff00000) {
      if (iy === 0x7ff00000) { if (m === 0) return pi_o_4 + tiny; if (m === 1) return -pi_o_4 - tiny; if (m === 2) return 3.0 * pi_o_4 + tiny; return -3.0 * pi_o_4 - tiny; }
      if (m === 0) return 0.0; if (m === 1) return -0.0; if (m === 2) return PI + tiny; return -PI - tiny;
    }
    if (iy === 0x7ff00000) return hy < 0 ? -pi_o_2 - tiny : pi_o_2 + tiny;
    const k = (iy - ix) >> 20;
    let z, mm = m;
    if (k > 60) { z = pi_o_2 + 0.5 * pi_lo; mm &= 1; }
    else if (hx < 0 && k < -60) z = 0.0;
    else z = atan(abs(y / x));
    if (mm === 0) return z; if (mm === 1) return -z; if (mm === 2) return PI - (z - pi_lo); return (z - pi_lo) - PI;
  }

  // ------------------------------------------------------------------ exp and log: fdlibm e_exp and e_log
  const ln2HI = 6.93147180369123816490e-01, ln2LO = 1.90821492927058770002e-10, invln2 = 1.44269504088896338700e+00;
  const P1 = 1.66666666666666019037e-01, P2 = -2.77777777770155933842e-03, P3 = 6.61375632143793436117e-05, P4 = -1.65339022054652515390e-06, P5 = 4.13813679705723846039e-08;
  const o_threshold = 7.09782712893383973096e+02, u_threshold = -7.45133219101941108420e+02;
  function exp(x) {
    const hx0 = hi(x), xsb = (hx0 >> 31) & 1, hx = hx0 & 0x7fffffff;
    if (hx >= 0x40862E42) {
      if (hx >= 0x7ff00000) { if (((hx & 0xfffff) | lo(x)) !== 0) return NaN; return xsb === 0 ? x : 0.0; }
      if (x > o_threshold) return Infinity;
      if (x < u_threshold) return 0.0;
    }
    let k = 0, hiPart = 0, loPart = 0;
    if (hx > 0x3fd62e42) {
      if (hx < 0x3FF0A2E4) { hiPart = x - (xsb === 0 ? ln2HI : -ln2HI); loPart = xsb === 0 ? ln2LO : -ln2LO; k = 1 - xsb - xsb; }
      else { k = (invln2 * x + (xsb === 0 ? 0.5 : -0.5)) | 0; const t = k; hiPart = x - t * ln2HI; loPart = t * ln2LO; }   // (| 0 truncates toward zero as C's (int) does)
      x = hiPart - loPart;
    } else if (hx < 0x3e300000) return 1.0 + x;
    const t = x * x, c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
    if (k === 0) return 1.0 - ((x * c) / (c - 2.0) - x);
    const y = 1.0 - ((loPart - (x * c) / (2.0 - c)) - hiPart);
    return scalbn(y, k);
  }
  const ln2_hi = 6.93147180369123816490e-01, ln2_lo = 1.90821492927058770002e-10, two54 = 1.80143985094819840000e+16;
  const Lg1 = 6.666666666666735130e-01, Lg2 = 3.999999999940941908e-01, Lg3 = 2.857142874366239149e-01, Lg4 = 2.222219843214978396e-01, Lg5 = 1.818357216161805012e-01, Lg6 = 1.531383769920937332e-01, Lg7 = 1.479819860511658591e-01;
  function log(x) {
    let hx = hi(x), lx = lo(x), k = 0;
    if (hx < 0x00100000) {
      if (((hx & 0x7fffffff) | lx) === 0) return -Infinity;
      if (hx < 0) return NaN;
      k -= 54; x *= two54; hx = hi(x);
    }
    if (hx >= 0x7ff00000) return x !== x ? NaN : (hx > 0 ? x : NaN);
    k += (hx >> 20) - 1023;
    hx &= 0x000fffff;
    const i = (hx + 0x95f64) & 0x100000;
    x = setHi(x, hx | (i ^ 0x3ff00000));
    k += i >> 20;
    const f = x - 1.0;
    if ((0x000fffff & (2 + hx)) < 3) {
      if (f === 0) { if (k === 0) return 0; const dk = k; return dk * ln2_hi + dk * ln2_lo; }
      const R = f * f * (0.5 - 0.33333333333333333 * f);
      if (k === 0) return f - R;
      const dk = k; return dk * ln2_hi - ((R - dk * ln2_lo) - f);
    }
    const s = f / (2.0 + f), dk = k, z = s * s, w = z * z, ii = hx - 0x6147a, jj = 0x6b851 - hx;
    const t1 = w * (Lg2 + w * (Lg4 + w * Lg6)), t2 = z * (Lg1 + w * (Lg3 + w * (Lg5 + w * Lg7))), R = t2 + t1;
    if ((ii | jj) > 0) {
      const hfsq = 0.5 * f * f;
      if (k === 0) return f - (hfsq - s * (hfsq + R));
      return dk * ln2_hi - ((hfsq - (s * (hfsq + R) + dk * ln2_lo)) - f);
    }
    if (k === 0) return f - s * (f - R);
    return dk * ln2_hi - ((s * (f - R) - dk * ln2_lo) - f);
  }
  // pow: the special cases of the standard, integer powers by squaring (exact where the double is), the rest as exp(y log |x|)
  function pow(x, y) {
    if (y === 0 || x === 1) return 1.0;
    if (x !== x || y !== y) return NaN;
    const ax = abs(x);
    if (y === Infinity) return ax === 1 ? 1.0 : ax > 1 ? Infinity : 0.0;
    if (y === -Infinity) return ax === 1 ? 1.0 : ax > 1 ? 0.0 : Infinity;
    const yint = floor(y) === y, yodd = yint && abs(y) < 9007199254740992 && (abs(y) % 2) === 1;
    if (x === Infinity) return y > 0 ? Infinity : 0.0;
    if (x === -Infinity) return y > 0 ? (yodd ? -Infinity : Infinity) : (yodd ? -0.0 : 0.0);
    if (x === 0) { if (y > 0) return (1 / x < 0 && yodd) ? -0.0 : 0.0; return (1 / x < 0 && yodd) ? -Infinity : Infinity; }
    if (x < 0 && !yint) return NaN;
    if (yint && abs(y) <= 1024) {
      let r = 1.0, b = x, e = abs(y);
      while (e > 0) { if (e % 2 === 1) r *= b; b *= b; e = floor(e / 2); }
      return y < 0 ? 1.0 / r : r;
    }
    const r = exp(y * log(ax));
    return x < 0 && yodd ? -r : r;
  }
  function hypot() {
    let s = 0;
    for (let i = 0; i < arguments.length; i++) { const v = +arguments[i]; if (v === Infinity || v === -Infinity) return Infinity; s += v * v; }
    return sqrt(s);
  }

  // ------------------------------------------------------------------ install over Math, and the self test
  const FN = { sin, cos, tan, atan, atan2, exp, log, pow, hypot };
  const native = {};
  for (const k of Object.keys(FN)) native[k] = Math[k];
  let installed = false;
  function install() { if (installed) return true; for (const k of Object.keys(FN)) { try { Object.defineProperty(Math, k, { value: FN[k], writable: true, configurable: true }); } catch (e) { Math[k] = FN[k]; } } installed = true; return true; }
  function uninstall() { if (!installed) return; for (const k of Object.keys(FN)) { try { Object.defineProperty(Math, k, { value: native[k], writable: true, configurable: true }); } catch (e) { Math[k] = native[k]; } } installed = false; }
  // selfTest(): 32 bits folded from the words of the functions at pinned arguments (a different engine that gave a different bit would change it)
  function selfTest() {
    let h = 0x811c9dc5 | 0;
    const mix = v => { F64[0] = v; h = Math.imul(h ^ U32[0], 16777619); h = Math.imul(h ^ U32[1], 16777619); };
    const args = [0, 1e-9, 0.1, 0.5, 0.7853981633974483, 1, 1.5707963267948966, 2, 3, 3.141592653589793, 4.5, 6.283185307179586, 10, 100, 1234.5678, -0.3, -2.5, -7, 1e5];
    for (const a of args) { mix(sin(a)); mix(cos(a)); mix(tan(a)); mix(atan(a)); mix(exp(a * 0.1)); mix(log(abs(a) + 0.5)); }
    for (const a of args) for (const b of [-3, -0.5, 0.25, 1, 7.5]) { mix(atan2(a, b)); mix(hypot(a, b)); mix(pow(abs(a) + 0.5, b)); }
    return h >>> 0;
  }
  const DMath = { sin, cos, tan, atan, atan2, exp, log, pow, hypot, install, uninstall, native, selfTest, get installed() { return installed; } };
  if (typeof module !== "undefined" && module.exports) module.exports = DMath; else root.DMath = DMath;
})(typeof window !== "undefined" ? window : globalThis);
