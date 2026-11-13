/**
 * Art Vision Engine — محرك الرؤية الحاسوبية لكشف تطابق اللوحات الفنية
 * ------------------------------------------------------------------
 * محرك مستقل (Pure TypeScript) يعمل في المتصفح وفي الخادم بدون أي مكتبات خارجية.
 *
 * فكرة العمل:
 *   1) استخراج نقاط مميزة محلية (ORB: FAST + rBRIEF) على هرم من المقاييس
 *      => ثابتة ضد الدوران، تغيّر المسافة (التكبير/التصغير)، والإضاءة.
 *   2) مطابقة النقاط بين لوحتين (Hamming + اختبار النسبة + التحقق المتبادل).
 *   3) تحقق هندسي بـ RANSAC لإيجاد مصفوفة إسقاط منظوري (Homography)
 *      => يكشف نفس اللوحة حتى لو صُوّرت بزاوية مائلة أو مقصوصة جزئياً أو بخلفية مختلفة.
 *   4) فهرس كلمات بصرية (Bag of Visual Words) لاختيار المرشحين بسرعة قبل التحقق الهندسي.
 */

export const ART_SIG_VERSION = 1;

const MAX_SIDE = 400;
const MIN_SIDE = 64;
const N_LEVELS = 4;
const SCALE_FACTOR = 1.25;
const MAX_FEATURES = 420;
const PATCH_R = 15;
const BORDER = 19;
const ANGLE_BINS = 32;
const DESC_WORDS = 8; // 256 bit
const HIST_BINS = 52;

export interface ArtSignature {
  v: number;
  /** analysed image size (after resize) */
  w: number;
  h: number;
  n: number;
  /** keypoint coordinates normalised by max(w,h) */
  xs: Float32Array;
  ys: Float32Array;
  /** n * 8 uint32 words (256-bit rBRIEF) */
  desc: Uint32Array;
  /** normalised HSV colour histogram */
  hist: Float32Array;
}

// ------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POP16 = (() => {
  const t = new Uint8Array(65536);
  for (let i = 1; i < 65536; i++) t[i] = (i & 1) + t[i >>> 1];
  return t;
})();

function popcnt32(x: number): number {
  return POP16[x & 0xffff] + POP16[x >>> 16];
}

/** Hamming distance between descriptor i of A and descriptor j of B */
function hamming(a: Uint32Array, ai: number, b: Uint32Array, bj: number): number {
  return (
    popcnt32(a[ai] ^ b[bj]) +
    popcnt32(a[ai + 1] ^ b[bj + 1]) +
    popcnt32(a[ai + 2] ^ b[bj + 2]) +
    popcnt32(a[ai + 3] ^ b[bj + 3]) +
    popcnt32(a[ai + 4] ^ b[bj + 4]) +
    popcnt32(a[ai + 5] ^ b[bj + 5]) +
    popcnt32(a[ai + 6] ^ b[bj + 6]) +
    popcnt32(a[ai + 7] ^ b[bj + 7])
  );
}

// rBRIEF sampling pattern (deterministic) + pre-rotated versions
const PATTERN: Int8Array[] = (() => {
  const rnd = mulberry32(0x5a17c0de);
  const gauss = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const sigma = (2 * PATCH_R + 1) / 5;
  const pick = (): [number, number] => {
    for (;;) {
      const x = gauss() * sigma;
      const y = gauss() * sigma;
      if (x * x + y * y <= 13 * 13) return [x, y];
    }
  };
  const base: number[] = [];
  for (let i = 0; i < 256; i++) {
    const [x1, y1] = pick();
    let [x2, y2] = pick();
    while (Math.abs(x1 - x2) + Math.abs(y1 - y2) < 2) [x2, y2] = pick();
    base.push(x1, y1, x2, y2);
  }
  const out: Int8Array[] = [];
  for (let b = 0; b < ANGLE_BINS; b++) {
    const ang = (b * 2 * Math.PI) / ANGLE_BINS;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const arr = new Int8Array(1024);
    for (let i = 0; i < 1024; i += 2) {
      const x = base[i];
      const y = base[i + 1];
      arr[i] = Math.round(c * x - s * y);
      arr[i + 1] = Math.round(s * x + c * y);
    }
    out.push(arr);
  }
  return out;
})();

// circular patch extents for intensity centroid
const UMAX = (() => {
  const u = new Int32Array(PATCH_R + 1);
  for (let v = 0; v <= PATCH_R; v++) u[v] = Math.floor(Math.sqrt(PATCH_R * PATCH_R - v * v) + 0.5);
  return u;
})();

const FAST_CIRCLE: [number, number][] = [
  [0, -3], [1, -3], [2, -2], [3, -1], [3, 0], [3, 1], [2, 2], [1, 3],
  [0, 3], [-1, 3], [-2, 2], [-3, 1], [-3, 0], [-3, -1], [-2, -2], [-1, -3],
];

// ------------------------------------------------------------------
// Image preparation
// ------------------------------------------------------------------

interface Prepared {
  w: number;
  h: number;
  gray: Float32Array;
  rgb: Uint8ClampedArray; // w*h*3
}

/** area-average downscale of an RGBA buffer so that max side <= MAX_SIDE */
function prepare(rgba: ArrayLike<number>, sw: number, sh: number): Prepared {
  const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const gray = new Float32Array(w * h);
  const rgb = new Uint8ClampedArray(w * h * 3);
  const fx = sw / w;
  const fy = sh / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * fy);
    const y1 = Math.max(y0 + 1, Math.min(sh, Math.floor((y + 1) * fy)));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * fx);
      const x1 = Math.max(x0 + 1, Math.min(sw, Math.floor((x + 1) * fx)));
      let r = 0;
      let g = 0;
      let b = 0;
      let cnt = 0;
      for (let yy = y0; yy < y1; yy++) {
        let p = (yy * sw + x0) * 4;
        for (let xx = x0; xx < x1; xx++) {
          r += rgba[p];
          g += rgba[p + 1];
          b += rgba[p + 2];
          cnt++;
          p += 4;
        }
      }
      r /= cnt;
      g /= cnt;
      b /= cnt;
      const o = y * w + x;
      rgb[o * 3] = r;
      rgb[o * 3 + 1] = g;
      rgb[o * 3 + 2] = b;
      gray[o] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }
  return { w, h, gray, rgb };
}

/** separable binomial [1 4 6 4 1]/16 blur */
function blur5(src: Float32Array, w: number, h: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const xm2 = x < 2 ? 0 : x - 2;
      const xm1 = x < 1 ? 0 : x - 1;
      const xp1 = x + 1 >= w ? w - 1 : x + 1;
      const xp2 = x + 2 >= w ? w - 1 : x + 2;
      tmp[row + x] =
        (src[row + xm2] + 4 * src[row + xm1] + 6 * src[row + x] + 4 * src[row + xp1] + src[row + xp2]) / 16;
    }
  }
  for (let y = 0; y < h; y++) {
    const ym2 = (y < 2 ? 0 : y - 2) * w;
    const ym1 = (y < 1 ? 0 : y - 1) * w;
    const yp1 = (y + 1 >= h ? h - 1 : y + 1) * w;
    const yp2 = (y + 2 >= h ? h - 1 : y + 2) * w;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      out[row + x] =
        (tmp[ym2 + x] + 4 * tmp[ym1 + x] + 6 * tmp[row + x] + 4 * tmp[yp1 + x] + tmp[yp2 + x]) / 16;
    }
  }
  return out;
}

function resizeBilinear(src: Float32Array, sw: number, sh: number, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  const fx = sw / w;
  const fy = sh / h;
  for (let y = 0; y < h; y++) {
    const syf = Math.min(sh - 1, Math.max(0, (y + 0.5) * fy - 0.5));
    const sy0 = Math.floor(syf);
    const sy1 = Math.min(sh - 1, sy0 + 1);
    const dy = syf - sy0;
    for (let x = 0; x < w; x++) {
      const sxf = Math.min(sw - 1, Math.max(0, (x + 0.5) * fx - 0.5));
      const sx0 = Math.floor(sxf);
      const sx1 = Math.min(sw - 1, sx0 + 1);
      const dx = sxf - sx0;
      const a = src[sy0 * sw + sx0];
      const b = src[sy0 * sw + sx1];
      const c = src[sy1 * sw + sx0];
      const d = src[sy1 * sw + sx1];
      out[y * w + x] = (a * (1 - dx) + b * dx) * (1 - dy) + (c * (1 - dx) + d * dx) * dy;
    }
  }
  return out;
}

/** robust contrast estimate (p95 - p5) used for an adaptive FAST threshold */
function contrastRange(gray: Float32Array): number {
  const hist = new Uint32Array(256);
  const step = Math.max(1, Math.floor(gray.length / 20000));
  let n = 0;
  for (let i = 0; i < gray.length; i += step) {
    hist[Math.max(0, Math.min(255, gray[i] | 0))]++;
    n++;
  }
  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= n * 0.05) {
      lo = i;
      break;
    }
  }
  acc = 0;
  for (let i = 255; i >= 0; i--) {
    acc += hist[i];
    if (acc >= n * 0.05) {
      hi = i;
      break;
    }
  }
  return Math.max(1, hi - lo);
}

// ------------------------------------------------------------------
// Feature detection
// ------------------------------------------------------------------

interface Corner {
  x: number;
  y: number;
  score: number;
}

function detectFast(img: Float32Array, w: number, h: number, t: number): Corner[] {
  const offs = FAST_CIRCLE.map(([dx, dy]) => dy * w + dx);
  const scoreMap = new Float32Array(w * h);
  const cand: number[] = [];
  const state = new Int8Array(16);
  const ys = BORDER - 3;
  for (let y = ys; y < h - ys; y++) {
    for (let x = ys; x < w - ys; x++) {
      const p = y * w + x;
      const v = img[p];
      const hiT = v + t;
      const loT = v - t;
      // quick rejection with compass points
      const c0 = img[p + offs[0]];
      const c4 = img[p + offs[4]];
      const c8 = img[p + offs[8]];
      const c12 = img[p + offs[12]];
      let nb = 0;
      let nd = 0;
      if (c0 > hiT) nb++; else if (c0 < loT) nd++;
      if (c4 > hiT) nb++; else if (c4 < loT) nd++;
      if (c8 > hiT) nb++; else if (c8 < loT) nd++;
      if (c12 > hiT) nb++; else if (c12 < loT) nd++;
      if (nb < 2 && nd < 2) continue;

      for (let k = 0; k < 16; k++) {
        const q = img[p + offs[k]];
        state[k] = q > hiT ? 1 : q < loT ? -1 : 0;
      }
      let best = 0;
      for (const sgn of [1, -1]) {
        let run = 0;
        for (let k = 0; k < 25; k++) {
          if (state[k & 15] === sgn) {
            run++;
            if (run >= 9) {
              best = sgn;
              break;
            }
          } else run = 0;
        }
        if (best) break;
      }
      if (!best) continue;
      let sc = 0;
      for (let k = 0; k < 16; k++) {
        const d = (img[p + offs[k]] - v) * best - t;
        if (d > 0) sc += d;
      }
      scoreMap[p] = sc;
      cand.push(p);
    }
  }
  const out: Corner[] = [];
  for (const p of cand) {
    const s = scoreMap[p];
    if (
      s >= scoreMap[p - 1] && s > scoreMap[p + 1] &&
      s >= scoreMap[p - w - 1] && s >= scoreMap[p - w] && s >= scoreMap[p - w + 1] &&
      s > scoreMap[p + w - 1] && s > scoreMap[p + w] && s > scoreMap[p + w + 1]
    ) {
      out.push({ x: p % w, y: (p / w) | 0, score: s });
    }
  }
  return out;
}

function harrisScore(img: Float32Array, w: number, x: number, y: number): number {
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let dy = -3; dy <= 3; dy++) {
    const row = (y + dy) * w;
    for (let dx = -3; dx <= 3; dx++) {
      const p = row + x + dx;
      const ix = img[p + 1] - img[p - 1];
      const iy = img[p + w] - img[p - w];
      sxx += ix * ix;
      syy += iy * iy;
      sxy += ix * iy;
    }
  }
  const tr = sxx + syy;
  return sxx * syy - sxy * sxy - 0.04 * tr * tr;
}

function orientation(sm: Float32Array, w: number, x: number, y: number): number {
  let m01 = 0;
  let m10 = 0;
  const c = y * w + x;
  for (let u = -PATCH_R; u <= PATCH_R; u++) m10 += u * sm[c + u];
  for (let v = 1; v <= PATCH_R; v++) {
    let vsum = 0;
    const d = UMAX[v];
    for (let u = -d; u <= d; u++) {
      const top = sm[c + u - v * w];
      const bot = sm[c + u + v * w];
      vsum += bot - top;
      m10 += u * (bot + top);
    }
    m01 += v * vsum;
  }
  return Math.atan2(m01, m10);
}

function describe(sm: Float32Array, w: number, x: number, y: number, angle: number, out: Uint32Array, o: number) {
  let bin = Math.round((angle / (2 * Math.PI)) * ANGLE_BINS);
  bin = ((bin % ANGLE_BINS) + ANGLE_BINS) % ANGLE_BINS;
  const pat = PATTERN[bin];
  const c = y * w + x;
  for (let word = 0; word < DESC_WORDS; word++) {
    let bits = 0;
    for (let b = 0; b < 32; b++) {
      const i = (word * 32 + b) * 4;
      const p1 = sm[c + pat[i + 1] * w + pat[i]];
      const p2 = sm[c + pat[i + 3] * w + pat[i + 2]];
      if (p1 < p2) bits |= 1 << b;
    }
    out[o + word] = bits >>> 0;
  }
}

function colourHistogram(p: Prepared): Float32Array {
  const hist = new Float32Array(HIST_BINS);
  const mx = Math.floor(p.w * 0.1);
  const my = Math.floor(p.h * 0.1);
  let total = 0;
  for (let y = my; y < p.h - my; y++) {
    for (let x = mx; x < p.w - mx; x++) {
      const o = (y * p.w + x) * 3;
      const r = p.rgb[o] / 255;
      const g = p.rgb[o + 1] / 255;
      const b = p.rgb[o + 2] / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const v = max;
      const s = max === 0 ? 0 : (max - min) / max;
      let bin: number;
      if (s < 0.18 || v < 0.15) {
        bin = 48 + Math.min(3, Math.floor(v * 4));
      } else {
        let hh: number;
        const d = max - min;
        if (max === r) hh = ((g - b) / d) % 6;
        else if (max === g) hh = (b - r) / d + 2;
        else hh = (r - g) / d + 4;
        hh = (hh * 60 + 360) % 360;
        const hb = Math.min(11, Math.floor(hh / 30));
        const sb = s < 0.5 ? 0 : 1;
        const vb = v < 0.6 ? 0 : 1;
        bin = hb * 4 + sb * 2 + vb;
      }
      hist[bin]++;
      total++;
    }
  }
  if (total > 0) for (let i = 0; i < HIST_BINS; i++) hist[i] /= total;
  return hist;
}

/**
 * استخراج البصمة البصرية المتقدمة من بكسلات صورة RGBA
 */
export function extractArtSignature(rgba: ArrayLike<number>, width: number, height: number): ArtSignature {
  const p = prepare(rgba, width, height);
  const hist = colourHistogram(p);
  const maxSide = Math.max(p.w, p.h);
  const empty: ArtSignature = {
    v: ART_SIG_VERSION, w: p.w, h: p.h, n: 0,
    xs: new Float32Array(0), ys: new Float32Array(0), desc: new Uint32Array(0), hist,
  };
  if (Math.min(p.w, p.h) < MIN_SIDE) return empty;

  const range = contrastRange(p.gray);
  const baseT = Math.max(6, Math.min(28, range * 0.09));

  interface Feat { x: number; y: number; level: number; score: number; }
  const levels: { w: number; h: number; img: Float32Array; sm: Float32Array; sc: number }[] = [];
  let cur = p.gray;
  let cw = p.w;
  let ch = p.h;
  for (let l = 0; l < N_LEVELS; l++) {
    if (l > 0) {
      const nw = Math.round(p.w / Math.pow(SCALE_FACTOR, l));
      const nh = Math.round(p.h / Math.pow(SCALE_FACTOR, l));
      if (Math.min(nw, nh) < 2 * BORDER + 8) break;
      cur = resizeBilinear(levels[l - 1].sm, cw, ch, nw, nh);
      cw = nw;
      ch = nh;
    }
    levels.push({ w: cw, h: ch, img: cur, sm: blur5(cur, cw, ch), sc: p.w / cw });
  }

  // feature budget per level (geometric series like ORB)
  const f = 1 / SCALE_FACTOR;
  const L = levels.length;
  const budget: number[] = [];
  let acc = 0;
  for (let l = 0; l < L; l++) {
    const n = l === L - 1 ? MAX_FEATURES - acc : Math.round((MAX_FEATURES * (1 - f) * Math.pow(f, l)) / (1 - Math.pow(f, L)));
    budget.push(Math.max(0, n));
    acc += n;
  }

  const feats: Feat[] = [];
  for (let l = 0; l < L; l++) {
    const lv = levels[l];
    let t = baseT;
    let corners = detectFast(lv.img, lv.w, lv.h, t);
    // adaptive: lower the threshold for low-texture images
    let tries = 0;
    while (corners.length < budget[l] * 1.5 && t > 4 && tries < 3) {
      t *= 0.65;
      corners = detectFast(lv.img, lv.w, lv.h, t);
      tries++;
    }
    const scored = corners
      .filter((c) => c.x >= BORDER && c.y >= BORDER && c.x < lv.w - BORDER && c.y < lv.h - BORDER)
      .map((c) => ({ x: c.x, y: c.y, score: harrisScore(lv.img, lv.w, c.x, c.y) }))
      .filter((c) => c.score > 0);

    // grid bucketing for spatial spread
    const cell = 24;
    const gx = Math.max(1, Math.ceil(lv.w / cell));
    const gy = Math.max(1, Math.ceil(lv.h / cell));
    const cap = Math.max(2, Math.ceil((budget[l] * 3) / (gx * gy)));
    const buckets = new Map<number, typeof scored>();
    for (const c of scored) {
      const k = Math.floor(c.y / cell) * gx + Math.floor(c.x / cell);
      let arr = buckets.get(k);
      if (!arr) {
        arr = [];
        buckets.set(k, arr);
      }
      arr.push(c);
    }
    const kept: typeof scored = [];
    buckets.forEach((arr) => {
      arr.sort((a, b) => b.score - a.score);
      for (let i = 0; i < Math.min(cap, arr.length); i++) kept.push(arr[i]);
    });
    kept.sort((a, b) => b.score - a.score);
    for (let i = 0; i < Math.min(budget[l], kept.length); i++) {
      feats.push({ x: kept[i].x, y: kept[i].y, level: l, score: kept[i].score });
    }
  }

  const n = feats.length;
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  const desc = new Uint32Array(n * DESC_WORDS);
  for (let i = 0; i < n; i++) {
    const ft = feats[i];
    const lv = levels[ft.level];
    const ang = orientation(lv.sm, lv.w, ft.x, ft.y);
    describe(lv.sm, lv.w, ft.x, ft.y, ang, desc, i * DESC_WORDS);
    xs[i] = (ft.x * lv.sc) / maxSide;
    ys[i] = (ft.y * lv.sc) / maxSide;
  }
  return { v: ART_SIG_VERSION, w: p.w, h: p.h, n, xs, ys, desc, hist };
}

// ------------------------------------------------------------------
// Serialisation (compact base64)
// ------------------------------------------------------------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_REV = (() => {
  const r = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) r[B64.charCodeAt(i)] = i;
  return r;
})();

function bytesToB64(bytes: Uint8Array): string {
  const parts: string[] = [];
  let chunk = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const t = (a << 16) | (b << 8) | c;
    chunk +=
      B64[(t >> 18) & 63] +
      B64[(t >> 12) & 63] +
      (i + 1 < bytes.length ? B64[(t >> 6) & 63] : '=') +
      (i + 2 < bytes.length ? B64[t & 63] : '=');
    if (chunk.length > 8192) {
      parts.push(chunk);
      chunk = '';
    }
  }
  parts.push(chunk);
  return parts.join('');
}

function b64ToBytes(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(len);
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64_REV[clean.charCodeAt(i)];
    const b = B64_REV[clean.charCodeAt(i + 1)];
    const c = i + 2 < clean.length ? B64_REV[clean.charCodeAt(i + 2)] : 0;
    const d = i + 3 < clean.length ? B64_REV[clean.charCodeAt(i + 3)] : 0;
    const t = (a << 18) | (b << 12) | ((c < 0 ? 0 : c) << 6) | (d < 0 ? 0 : d);
    if (o < len) out[o++] = (t >> 16) & 255;
    if (o < len) out[o++] = (t >> 8) & 255;
    if (o < len) out[o++] = t & 255;
  }
  return out;
}

export function packArtSignature(sig: ArtSignature): string {
  const headerLen = 12;
  const total = headerLen + HIST_BINS + sig.n * 4 + sig.n * DESC_WORDS * 4;
  const buf = new Uint8Array(total);
  const dv = new DataView(buf.buffer);
  buf[0] = 65; // 'A'
  buf[1] = 86; // 'V'
  buf[2] = sig.v;
  buf[3] = HIST_BINS;
  dv.setUint16(4, sig.w, true);
  dv.setUint16(6, sig.h, true);
  dv.setUint16(8, sig.n, true);
  let o = headerLen;
  let hmax = 0;
  for (let i = 0; i < HIST_BINS; i++) hmax = Math.max(hmax, sig.hist[i] || 0);
  for (let i = 0; i < HIST_BINS; i++) buf[o++] = hmax > 0 ? Math.round(((sig.hist[i] || 0) / hmax) * 255) : 0;
  for (let i = 0; i < sig.n; i++) {
    dv.setUint16(o, Math.round(Math.max(0, Math.min(1, sig.xs[i])) * 65535), true);
    dv.setUint16(o + 2, Math.round(Math.max(0, Math.min(1, sig.ys[i])) * 65535), true);
    o += 4;
  }
  for (let i = 0; i < sig.n * DESC_WORDS; i++) {
    dv.setUint32(o, sig.desc[i], true);
    o += 4;
  }
  return bytesToB64(buf);
}

export function unpackArtSignature(s: string): ArtSignature | null {
  try {
    const buf = b64ToBytes(s);
    if (buf.length < 12 || buf[0] !== 65 || buf[1] !== 86) return null;
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const v = buf[2];
    if (v !== ART_SIG_VERSION) return null;
    const hb = buf[3];
    const w = dv.getUint16(4, true);
    const h = dv.getUint16(6, true);
    const n = dv.getUint16(8, true);
    let o = 12;
    if (buf.length < o + hb + n * 4 + n * DESC_WORDS * 4) return null;
    const hist = new Float32Array(HIST_BINS);
    let sum = 0;
    for (let i = 0; i < hb; i++) {
      if (i < HIST_BINS) {
        hist[i] = buf[o + i];
        sum += buf[o + i];
      }
    }
    if (sum > 0) for (let i = 0; i < HIST_BINS; i++) hist[i] /= sum;
    o += hb;
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      xs[i] = dv.getUint16(o, true) / 65535;
      ys[i] = dv.getUint16(o + 2, true) / 65535;
      o += 4;
    }
    const desc = new Uint32Array(n * DESC_WORDS);
    for (let i = 0; i < n * DESC_WORDS; i++) {
      desc[i] = dv.getUint32(o, true);
      o += 4;
    }
    return { v, w, h, n, xs, ys, desc, hist };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------
// Geometric matching (descriptor matching + RANSAC homography)
// ------------------------------------------------------------------

export interface ArtMatchResult {
  /** geometrically verified correspondences */
  inliers: number;
  /** tentative correspondences before RANSAC */
  tentative: number;
  /** fraction of the image area covered by inliers (min of both images) */
  coverage: number;
  /** inliers / tentative */
  inlierRatio: number;
  /** colour histogram similarity 0..1 */
  colour: number;
  /** final calibrated similarity 0..100 */
  similarity: number;
  /** perspective tilt detected between the two photos (degrees, rough) */
  viewChange: 'none' | 'mild' | 'strong';
  rotated: boolean;
  scaleRatio: number;
}

function colourSimilarity(a: Float32Array, b: Float32Array): number {
  // Bhattacharyya coefficient
  let s = 0;
  for (let i = 0; i < HIST_BINS; i++) s += Math.sqrt((a[i] || 0) * (b[i] || 0));
  return Math.max(0, Math.min(1, s));
}

/** Solve an n x n system in-place (Gaussian elimination, partial pivoting). Returns false if singular. */
function solveLinear(A: Float64Array, bvec: Float64Array, n: number): boolean {
  for (let col = 0; col < n; col++) {
    let piv = col;
    let best = Math.abs(A[col * n + col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(A[r * n + col]);
      if (v > best) {
        best = v;
        piv = r;
      }
    }
    if (best < 1e-12) return false;
    if (piv !== col) {
      for (let c = 0; c < n; c++) {
        const t = A[col * n + c];
        A[col * n + c] = A[piv * n + c];
        A[piv * n + c] = t;
      }
      const t = bvec[col];
      bvec[col] = bvec[piv];
      bvec[piv] = t;
    }
    const d = A[col * n + col];
    for (let r = col + 1; r < n; r++) {
      const f = A[r * n + col] / d;
      if (f === 0) continue;
      for (let c = col; c < n; c++) A[r * n + c] -= f * A[col * n + c];
      bvec[r] -= f * bvec[col];
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let s = bvec[r];
    for (let c = r + 1; c < n; c++) s -= A[r * n + c] * bvec[c];
    bvec[r] = s / A[r * n + r];
  }
  return true;
}

/** Least squares homography (h33 = 1) from correspondences idx[] */
function fitHomography(
  ax: Float64Array, ay: Float64Array, bx: Float64Array, by: Float64Array,
  idx: ArrayLike<number>, count: number, out: Float64Array
): boolean {
  const ATA = new Float64Array(64);
  const ATb = new Float64Array(8);
  const row = new Float64Array(8);
  for (let k = 0; k < count; k++) {
    const i = idx[k];
    const x = ax[i];
    const y = ay[i];
    const u = bx[i];
    const v = by[i];
    // row for u
    row[0] = x; row[1] = y; row[2] = 1; row[3] = 0; row[4] = 0; row[5] = 0; row[6] = -u * x; row[7] = -u * y;
    for (let r = 0; r < 8; r++) {
      if (row[r] === 0) continue;
      for (let c = 0; c < 8; c++) ATA[r * 8 + c] += row[r] * row[c];
      ATb[r] += row[r] * u;
    }
    row[0] = 0; row[1] = 0; row[2] = 0; row[3] = x; row[4] = y; row[5] = 1; row[6] = -v * x; row[7] = -v * y;
    for (let r = 0; r < 8; r++) {
      if (row[r] === 0) continue;
      for (let c = 0; c < 8; c++) ATA[r * 8 + c] += row[r] * row[c];
      ATb[r] += row[r] * v;
    }
  }
  if (!solveLinear(ATA, ATb, 8)) return false;
  for (let i = 0; i < 8; i++) out[i] = ATb[i];
  out[8] = 1;
  return true;
}

function homographyIsSane(H: Float64Array, cx: number, cy: number): boolean {
  // Jacobian of the mapping at (cx, cy)
  const w = H[6] * cx + H[7] * cy + 1;
  if (!(w > 0.05)) return false;
  const u = (H[0] * cx + H[1] * cy + H[2]) / w;
  const v = (H[3] * cx + H[4] * cy + H[5]) / w;
  const j11 = (H[0] - u * H[6]) / w;
  const j12 = (H[1] - u * H[7]) / w;
  const j21 = (H[3] - v * H[6]) / w;
  const j22 = (H[4] - v * H[7]) / w;
  const det = j11 * j22 - j12 * j21;
  if (!(det > 0.04 && det < 25)) return false; // no mirroring, bounded scale change
  // anisotropy (extreme shear = degenerate)
  const n1 = Math.hypot(j11, j21);
  const n2 = Math.hypot(j12, j22);
  const an = Math.max(n1, n2) / Math.max(1e-9, Math.min(n1, n2));
  if (an > 6) return false;
  // perspective strength must stay physical
  if (Math.abs(H[6]) > 3 || Math.abs(H[7]) > 3) return false;
  return true;
}

function countInliers(
  H: Float64Array, ax: Float64Array, ay: Float64Array, bx: Float64Array, by: Float64Array,
  m: number, t2: number, mask: Uint8Array | null
): number {
  let c = 0;
  for (let i = 0; i < m; i++) {
    const x = ax[i];
    const y = ay[i];
    const w = H[6] * x + H[7] * y + 1;
    let ok = false;
    if (w > 1e-6) {
      const du = (H[0] * x + H[1] * y + H[2]) / w - bx[i];
      const dv = (H[3] * x + H[4] * y + H[5]) / w - by[i];
      ok = du * du + dv * dv < t2;
    }
    if (mask) mask[i] = ok ? 1 : 0;
    if (ok) c++;
  }
  return c;
}

function bboxArea(xs: Float64Array, ys: Float64Array, mask: Uint8Array, m: number): number {
  let minx = Infinity;
  let miny = Infinity;
  let maxx = -Infinity;
  let maxy = -Infinity;
  for (let i = 0; i < m; i++) {
    if (!mask[i]) continue;
    if (xs[i] < minx) minx = xs[i];
    if (xs[i] > maxx) maxx = xs[i];
    if (ys[i] < miny) miny = ys[i];
    if (ys[i] > maxy) maxy = ys[i];
  }
  if (maxx < minx) return 0;
  return (maxx - minx) * (maxy - miny);
}

/** تحويل عدد النقاط المتطابقة هندسياً إلى نسبة تشابه معايرة */
export function calibrateSimilarity(inliers: number, coverage: number, inlierRatio: number): number {
  if (inliers < 6) return Math.round(inliers * 2);
  // logistic curve calibrated on unrelated-painting statistics (random pairs rarely exceed ~10 inliers)
  let s = 100 / (1 + Math.exp(-(inliers - 15) / 3.2));
  // penalise matches concentrated in a tiny region (logo, ruler, table texture...)
  const covFactor = Math.max(0.35, Math.min(1, coverage / 0.06));
  // a high inlier ratio is strong supporting evidence
  const ratioBoost = inlierRatio > 0.5 ? 1.06 : inlierRatio < 0.15 ? 0.85 : 1;
  s = s * covFactor * ratioBoost;
  return Math.max(0, Math.min(100, Math.round(s)));
}

const MATCH_SCRATCH = {
  rowBest: new Int32Array(0),
  rowD1: new Int32Array(0),
  rowD2: new Int32Array(0),
  colBest: new Int32Array(0),
  colD: new Int32Array(0),
};

/**
 * المطابقة الهندسية الكاملة بين بصمتين
 */
export function matchArtSignatures(a: ArtSignature, b: ArtSignature): ArtMatchResult {
  const colour = colourSimilarity(a.hist, b.hist);
  const empty: ArtMatchResult = {
    inliers: 0, tentative: 0, coverage: 0, inlierRatio: 0, colour, similarity: 0,
    viewChange: 'none', rotated: false, scaleRatio: 1,
  };
  if (a.n < 10 || b.n < 10) return empty;

  const na = a.n;
  const nb = b.n;
  if (MATCH_SCRATCH.rowBest.length < na) {
    MATCH_SCRATCH.rowBest = new Int32Array(na);
    MATCH_SCRATCH.rowD1 = new Int32Array(na);
    MATCH_SCRATCH.rowD2 = new Int32Array(na);
  }
  if (MATCH_SCRATCH.colBest.length < nb) {
    MATCH_SCRATCH.colBest = new Int32Array(nb);
    MATCH_SCRATCH.colD = new Int32Array(nb);
  }
  const { rowBest, rowD1, rowD2, colBest, colD } = MATCH_SCRATCH;
  colD.fill(1 << 20, 0, nb);
  const A = a.desc;
  const B = b.desc;
  for (let i = 0; i < na; i++) {
    const ai = i * 8;
    const a0 = A[ai], a1 = A[ai + 1], a2 = A[ai + 2], a3 = A[ai + 3];
    const a4 = A[ai + 4], a5 = A[ai + 5], a6 = A[ai + 6], a7 = A[ai + 7];
    let d1 = 1 << 20;
    let d2 = 1 << 20;
    let bj = -1;
    for (let j = 0; j < nb; j++) {
      const o = j * 8;
      let x = a0 ^ B[o];
      let d = POP16[x & 0xffff] + POP16[x >>> 16];
      x = a1 ^ B[o + 1]; d += POP16[x & 0xffff] + POP16[x >>> 16];
      x = a2 ^ B[o + 2]; d += POP16[x & 0xffff] + POP16[x >>> 16];
      x = a3 ^ B[o + 3]; d += POP16[x & 0xffff] + POP16[x >>> 16];
      if (d > d2 && d > colD[j]) continue; // cannot improve anything
      x = a4 ^ B[o + 4]; d += POP16[x & 0xffff] + POP16[x >>> 16];
      x = a5 ^ B[o + 5]; d += POP16[x & 0xffff] + POP16[x >>> 16];
      x = a6 ^ B[o + 6]; d += POP16[x & 0xffff] + POP16[x >>> 16];
      x = a7 ^ B[o + 7]; d += POP16[x & 0xffff] + POP16[x >>> 16];
      if (d < d1) {
        d2 = d1;
        d1 = d;
        bj = j;
      } else if (d < d2) {
        d2 = d;
      }
      if (d < colD[j]) {
        colD[j] = d;
        colBest[j] = i;
      }
    }
    rowBest[i] = bj;
    rowD1[i] = d1;
    rowD2[i] = d2;
  }

  // tentative matches: ratio test + mutual nearest neighbour
  const tent: number[] = [];
  for (let i = 0; i < na; i++) {
    const j = rowBest[i];
    if (j < 0) continue;
    const d1 = rowD1[i];
    if (d1 > 72) continue;
    if (d1 >= 0.85 * rowD2[i]) continue;
    if (colBest[j] !== i) continue;
    tent.push(i, j);
  }
  const m = tent.length / 2;
  if (m < 8) return { ...empty, tentative: m };

  const ax = new Float64Array(m);
  const ay = new Float64Array(m);
  const bx = new Float64Array(m);
  const by = new Float64Array(m);
  for (let k = 0; k < m; k++) {
    ax[k] = a.xs[tent[2 * k]];
    ay[k] = a.ys[tent[2 * k]];
    bx[k] = b.xs[tent[2 * k + 1]];
    by[k] = b.ys[tent[2 * k + 1]];
  }

  // RANSAC
  const rnd = mulberry32(0x1234567 ^ (na * 31 + nb * 17 + m));
  const thr = 0.022;
  const t2 = thr * thr;
  const H = new Float64Array(9);
  const bestH = new Float64Array(9);
  let bestCount = 0;
  const sample = new Int32Array(4);
  let maxIter = 600;
  const acx = (() => {
    let s = 0;
    for (let k = 0; k < m; k++) s += ax[k];
    return s / m;
  })();
  const acy = (() => {
    let s = 0;
    for (let k = 0; k < m; k++) s += ay[k];
    return s / m;
  })();

  for (let it = 0; it < maxIter; it++) {
    // draw 4 distinct, well-spread samples
    let okSample = false;
    for (let attempt = 0; attempt < 10 && !okSample; attempt++) {
      for (let s = 0; s < 4; s++) {
        let r: number;
        let dup: boolean;
        do {
          r = Math.floor(rnd() * m);
          dup = false;
          for (let q = 0; q < s; q++) if (sample[q] === r) dup = true;
        } while (dup);
        sample[s] = r;
      }
      okSample = true;
      // no near-duplicate points and no collinear triples in both images
      for (let p = 0; p < 4 && okSample; p++) {
        for (let q = p + 1; q < 4 && okSample; q++) {
          const dxa = ax[sample[p]] - ax[sample[q]];
          const dya = ay[sample[p]] - ay[sample[q]];
          const dxb = bx[sample[p]] - bx[sample[q]];
          const dyb = by[sample[p]] - by[sample[q]];
          if (dxa * dxa + dya * dya < 0.0009 || dxb * dxb + dyb * dyb < 0.0009) okSample = false;
        }
      }
      if (okSample) {
        for (let p = 0; p < 4 && okSample; p++) {
          const i0 = sample[p];
          const i1 = sample[(p + 1) % 4];
          const i2 = sample[(p + 2) % 4];
          const areaA = (ax[i1] - ax[i0]) * (ay[i2] - ay[i0]) - (ay[i1] - ay[i0]) * (ax[i2] - ax[i0]);
          const areaB = (bx[i1] - bx[i0]) * (by[i2] - by[i0]) - (by[i1] - by[i0]) * (bx[i2] - bx[i0]);
          if (Math.abs(areaA) < 2e-4 || Math.abs(areaB) < 2e-4) okSample = false;
          // orientation must be preserved (no mirroring)
          else if (areaA * areaB < 0) okSample = false;
        }
      }
    }
    if (!okSample) continue;

    // exact homography from 4 points (8x8 system)
    const M = new Float64Array(64);
    const rhs = new Float64Array(8);
    for (let s = 0; s < 4; s++) {
      const i = sample[s];
      const x = ax[i];
      const y = ay[i];
      const u = bx[i];
      const v = by[i];
      const r1 = s * 2 * 8;
      M[r1] = x; M[r1 + 1] = y; M[r1 + 2] = 1; M[r1 + 6] = -u * x; M[r1 + 7] = -u * y;
      rhs[s * 2] = u;
      const r2 = (s * 2 + 1) * 8;
      M[r2 + 3] = x; M[r2 + 4] = y; M[r2 + 5] = 1; M[r2 + 6] = -v * x; M[r2 + 7] = -v * y;
      rhs[s * 2 + 1] = v;
    }
    if (!solveLinear(M, rhs, 8)) continue;
    for (let i = 0; i < 8; i++) H[i] = rhs[i];
    H[8] = 1;
    if (!homographyIsSane(H, acx, acy)) continue;

    const c = countInliers(H, ax, ay, bx, by, m, t2, null);
    if (c > bestCount) {
      bestCount = c;
      bestH.set(H);
      const w = c / m;
      const p4 = w * w * w * w;
      if (p4 > 1e-9) {
        const need = Math.ceil(Math.log(1 - 0.997) / Math.log(Math.max(1e-12, 1 - p4)));
        maxIter = Math.min(maxIter, Math.max(60, need));
      }
    }
  }

  if (bestCount < 5) return { ...empty, tentative: m };

  // local optimisation: refit on inliers and recount (twice)
  const mask = new Uint8Array(m);
  let inl = countInliers(bestH, ax, ay, bx, by, m, t2, mask);
  for (let pass = 0; pass < 2; pass++) {
    const idx: number[] = [];
    for (let i = 0; i < m; i++) if (mask[i]) idx.push(i);
    if (idx.length < 6) break;
    const H2 = new Float64Array(9);
    if (!fitHomography(ax, ay, bx, by, idx, idx.length, H2)) break;
    if (!homographyIsSane(H2, acx, acy)) break;
    const mask2 = new Uint8Array(m);
    const c2 = countInliers(H2, ax, ay, bx, by, m, t2, mask2);
    if (c2 >= inl) {
      inl = c2;
      bestH.set(H2);
      mask.set(mask2);
    } else break;
  }

  // inliers must map distinct keypoints (avoid many-to-one degenerate clusters)
  const aw = a.w / Math.max(a.w, a.h);
  const ah = a.h / Math.max(a.w, a.h);
  const bw = b.w / Math.max(b.w, b.h);
  const bh = b.h / Math.max(b.w, b.h);
  const covA = bboxArea(ax, ay, mask, m) / Math.max(1e-6, aw * ah);
  const covB = bboxArea(bx, by, mask, m) / Math.max(1e-6, bw * bh);
  const coverage = Math.min(covA, covB);
  const inlierRatio = inl / m;

  // describe the geometric relation for the report
  const cx = acx;
  const cy = acy;
  const w0 = bestH[6] * cx + bestH[7] * cy + 1;
  const u0 = (bestH[0] * cx + bestH[1] * cy + bestH[2]) / w0;
  const j11 = (bestH[0] - u0 * bestH[6]) / w0;
  const j21 = (bestH[3] - ((bestH[3] * cx + bestH[4] * cy + bestH[5]) / w0) * bestH[6]) / w0;
  const rotation = Math.abs((Math.atan2(j21, j11) * 180) / Math.PI);
  const persp = Math.hypot(bestH[6], bestH[7]);
  const scaleRatio = Math.sqrt(Math.max(1e-9, covB / Math.max(1e-9, covA)));

  let similarity = calibrateSimilarity(inl, coverage, inlierRatio);
  // colour agreement adds a small amount of confidence for borderline cases
  if (similarity >= 40 && similarity < 95) {
    similarity = Math.min(100, Math.round(similarity + (colour - 0.75) * 12));
  }

  return {
    inliers: inl,
    tentative: m,
    coverage: Math.round(coverage * 1000) / 1000,
    inlierRatio: Math.round(inlierRatio * 1000) / 1000,
    colour: Math.round(colour * 1000) / 1000,
    similarity: Math.max(0, similarity),
    viewChange: persp > 0.35 ? 'strong' : persp > 0.1 ? 'mild' : 'none',
    rotated: rotation > 12,
    scaleRatio: Math.round(scaleRatio * 100) / 100,
  };
}

// ------------------------------------------------------------------
// Candidate retrieval (Bag of Visual Words, vocabulary learnt on the fly)
// ------------------------------------------------------------------

/**
 * يبني فهرس كلمات بصرية لكل الصور ويعيد أفضل المرشحين لكل صورة
 * (يمنع المقارنة الهندسية المكلفة بين كل الأزواج).
 */
export function retrieveCandidatePairs(
  sigs: (ArtSignature | null)[],
  opts: { topK?: number; allowPair?: (i: number, j: number) => boolean } = {}
): Array<[number, number, number]> {
  const topK = opts.topK ?? 10;
  const N = sigs.length;
  const valid: number[] = [];
  for (let i = 0; i < N; i++) if (sigs[i] && sigs[i]!.n >= 10) valid.push(i);
  if (valid.length < 2) return [];

  // small collections: verify everything
  if (valid.length <= 40) {
    const out: Array<[number, number, number]> = [];
    for (let x = 0; x < valid.length; x++) {
      for (let y = x + 1; y < valid.length; y++) {
        const i = valid[x];
        const j = valid[y];
        if (opts.allowPair && !opts.allowPair(i, j)) continue;
        out.push([i, j, 1]);
      }
    }
    return out;
  }

  // --- vocabulary: two-level hierarchical k-majority on a sample ---
  const K1 = 24;
  const K2 = 24;
  const rnd = mulberry32(0xbeef);
  const all: { s: number; k: number }[] = [];
  for (const i of valid) {
    const sg = sigs[i]!;
    for (let k = 0; k < sg.n; k++) all.push({ s: i, k });
  }
  const getDesc = (e: { s: number; k: number }) => sigs[e.s]!.desc;
  const sampleN = Math.min(all.length, 24000);
  const sample: { s: number; k: number }[] = [];
  for (let i = 0; i < sampleN; i++) sample.push(all[Math.floor(rnd() * all.length)]);

  const kmajority = (items: { s: number; k: number }[], K: number, iters: number): Uint32Array => {
    const centers = new Uint32Array(K * 8);
    const kk = Math.min(K, items.length);
    for (let c = 0; c < kk; c++) {
      const e = items[Math.floor(rnd() * items.length)];
      const d = getDesc(e);
      for (let w = 0; w < 8; w++) centers[c * 8 + w] = d[e.k * 8 + w];
    }
    for (let it = 0; it < iters; it++) {
      const counts = new Int32Array(K * 256);
      const sizes = new Int32Array(K);
      for (const e of items) {
        const d = getDesc(e);
        let best = 0;
        let bd = 1 << 20;
        for (let c = 0; c < kk; c++) {
          const dd = hamming(d, e.k * 8, centers, c * 8);
          if (dd < bd) {
            bd = dd;
            best = c;
          }
        }
        sizes[best]++;
        for (let w = 0; w < 8; w++) {
          const word = d[e.k * 8 + w];
          for (let bit = 0; bit < 32; bit++) if ((word >>> bit) & 1) counts[best * 256 + w * 32 + bit]++;
        }
      }
      for (let c = 0; c < kk; c++) {
        if (sizes[c] === 0) continue;
        for (let w = 0; w < 8; w++) {
          let word = 0;
          for (let bit = 0; bit < 32; bit++) if (counts[c * 256 + w * 32 + bit] * 2 > sizes[c]) word |= 1 << bit;
          centers[c * 8 + w] = word >>> 0;
        }
      }
    }
    return centers;
  };

  const nearest = (d: Uint32Array, o: number, centers: Uint32Array, K: number) => {
    let best = 0;
    let bd = 1 << 20;
    for (let c = 0; c < K; c++) {
      const dd = hamming(d, o, centers, c * 8);
      if (dd < bd) {
        bd = dd;
        best = c;
      }
    }
    return best;
  };

  const top = kmajority(sample, K1, 3);
  const groups: { s: number; k: number }[][] = Array.from({ length: K1 }, () => []);
  for (const e of sample) groups[nearest(getDesc(e), e.k * 8, top, K1)].push(e);
  const sub: Uint32Array[] = groups.map((g) => (g.length >= K2 ? kmajority(g, K2, 2) : kmajority(g.length ? g : sample, K2, 1)));

  const V = K1 * K2;
  // word assignment per image
  const words: Int32Array[] = new Array(N);
  const df = new Int32Array(V);
  for (const i of valid) {
    const sg = sigs[i]!;
    const arr = new Int32Array(sg.n);
    const seen = new Uint8Array(V);
    for (let k = 0; k < sg.n; k++) {
      const t = nearest(sg.desc, k * 8, top, K1);
      const s = nearest(sg.desc, k * 8, sub[t], K2);
      const wd = t * K2 + s;
      arr[k] = wd;
      if (!seen[wd]) {
        seen[wd] = 1;
        df[wd]++;
      }
    }
    words[i] = arr;
  }
  const idf = new Float32Array(V);
  for (let wd = 0; wd < V; wd++) idf[wd] = df[wd] > 0 ? Math.log(valid.length / df[wd]) : 0;

  // tf-idf vectors (sparse) + inverted index
  const inv: Array<Array<[number, number]>> = Array.from({ length: V }, () => []);
  for (const i of valid) {
    const tf = new Map<number, number>();
    for (const wd of words[i]) tf.set(wd, (tf.get(wd) || 0) + 1);
    let norm = 0;
    const entries: [number, number][] = [];
    tf.forEach((c, wd) => {
      const val = c * idf[wd];
      if (val > 0) {
        entries.push([wd, val]);
        norm += val * val;
      }
    });
    norm = Math.sqrt(norm) || 1;
    for (const [wd, val] of entries) inv[wd].push([i, val / norm]);
  }

  const scores = new Float32Array(N);
  const pairs = new Map<string, [number, number, number]>();
  const vecs = new Map<number, Array<[number, number]>>();
  for (let wd = 0; wd < V; wd++) {
    for (const [i, val] of inv[wd]) {
      let arr = vecs.get(i);
      if (!arr) {
        arr = [];
        vecs.set(i, arr);
      }
      arr.push([wd, val]);
    }
  }
  for (const i of valid) {
    scores.fill(0);
    const vec = vecs.get(i) || [];
    for (const [wd, val] of vec) {
      // skip stop words (present in more than 40% of the images)
      if (df[wd] > valid.length * 0.4) continue;
      for (const [j, v2] of inv[wd]) if (j !== i) scores[j] += val * v2;
    }
    const ranked: number[] = [];
    for (const j of valid) {
      if (j === i || scores[j] <= 0) continue;
      if (opts.allowPair && !opts.allowPair(i, j)) continue;
      ranked.push(j);
    }
    ranked.sort((p, q) => scores[q] - scores[p]);
    for (let r = 0; r < Math.min(topK, ranked.length); r++) {
      const j = ranked[r];
      const key = i < j ? `${i}_${j}` : `${j}_${i}`;
      const prev = pairs.get(key);
      if (!prev || prev[2] < scores[j]) pairs.set(key, [Math.min(i, j), Math.max(i, j), scores[j]]);
    }
  }
  return Array.from(pairs.values()).sort((p, q) => q[2] - p[2]);
}
