/**
 * Laplace Transform Solver Engine
 * Solves 1st and 2nd order linear ODEs with constant coefficients.
 *
 * Supports:
 *   a*y' + b*y = f(t)      (1st order)
 *   a*y'' + b*y' + c*y = f(t)  (2nd order)
 *
 * Forcing functions: 0, constant K, e^(at), sin(wt), cos(wt), t
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n) {
  if (Math.abs(n) < 1e-9) return '0';
  const r = Math.round(n * 1e6) / 1e6;
  // Convert to fraction-like string if close to a simple fraction
  for (const d of [1, 2, 3, 4, 6, 8, 10, 12, 16]) {
    const num = Math.round(r * d);
    if (Math.abs(num / d - r) < 1e-5) {
      if (d === 1) return String(num);
      return `\\frac{${num}}{${d}}`;
    }
  }
  return r.toFixed(4);
}

function fmtCoeff(n, forceSign = false) {
  if (Math.abs(n) < 1e-9) return forceSign ? '' : '0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : (forceSign ? '+' : '');
  const mag = fmtNum(abs);
  return `${sign}${mag}`;
}

// Build "A * e^(r*t)" part, handling A=±1 and r=0 cleanly
function fmtExpTerm(A, r) {
  if (Math.abs(A) < 1e-9) return null;
  const absA = Math.abs(A);
  const sign = A < 0 ? '-' : '';

  // Coefficient string (omit 1)
  const coeffStr = Math.abs(absA - 1) < 1e-9 ? sign : `${sign}${fmtNum(absA)}`;

  if (Math.abs(r) < 1e-9) {
    // e^0 = 1, so just the coefficient
    return coeffStr === '' ? '1' : (coeffStr === '-' ? '-1' : coeffStr);
  }

  // Exponent: simplify 1t -> t, -1t -> -t
  const rStr = Math.abs(Math.abs(r) - 1) < 1e-9
    ? (r < 0 ? '-t' : 't')
    : `${fmtNum(r)}t`;

  return `${coeffStr}e^{${rStr}}`;
}

// Build trig * exp term: coeff * e^(alpha*t) * trig(omega*t)
function fmtTrigExpTerm(coeff, alpha, omega, trigFn, withT = false) {
  if (Math.abs(coeff) < 1e-9) return null;
  const absC = Math.abs(coeff);
  const sign = coeff < 0 ? '-' : '';
  const coeffStr = Math.abs(absC - 1) < 1e-9 ? sign : `${sign}${fmtNum(absC)}`;

  const expStr = Math.abs(alpha) < 1e-9 ? '' : `e^{${fmtNum(alpha) === '1' ? '' : fmtNum(alpha)}t}`;
  const omStr = Math.abs(omega - 1) < 1e-9 ? 't' : `${fmtNum(omega)}t`;
  const tStr = withT ? 't' : '';
  const trig = `${trigFn}(${omStr})`;

  return `${coeffStr}${tStr}${expStr}${trig}`;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseODE(raw) {
  const input = raw.trim().replace(/\s+/g, ' ');
  const eqIdx = input.indexOf('=');
  if (eqIdx === -1) throw new Error("La ecuación necesita el signo '='");

  const lhs = input.slice(0, eqIdx).trim();
  const rhs = input.slice(eqIdx + 1).trim();

  // Detect order from LHS
  const hasSecond = /y''|y"|d2y/.test(lhs);
  const hasFirst  = /y'|dy/.test(lhs);
  const order = hasSecond ? 2 : (hasFirst ? 1 : 0);
  if (order === 0) throw new Error('No se detectó ninguna derivada (y\' o y\'\')');

  // Extract coefficients by parsing terms
  const a2 = hasSecond ? extractTermCoeff(lhs, /([+-]?\s*[\d./]*)\s*\*?\s*y''/) : 0;
  const a1 = extractTermCoeff(lhs, /([+-]?\s*[\d./]*)\s*\*?\s*y'(?!')/);
  const a0 = extractTermCoeff(lhs, /([+-]?\s*[\d./]*)\s*\*?\s*y(?!')/);

  const forcing = parseForcing(rhs);

  return { order, a2, a1, a0, forcing, lhs, rhs };
}

function extractTermCoeff(expr, pattern) {
  const m = expr.match(pattern);
  if (!m) return 0;
  const raw = (m[1] || '').replace(/\s+/g, '');
  if (raw === '' || raw === '+') return 1;
  if (raw === '-') return -1;
  const n = parseFloat(raw);
  return isNaN(n) ? 1 : n;
}

function parseForcing(rhs) {
  const s = rhs.trim().replace(/\s+/g, '');

  if (s === '0' || s === '') return { type: 'zero', A: 0, alpha: 0, omega: 0 };

  // Pure number
  if (/^-?[\d.]+$/.test(s)) {
    return { type: 'constant', A: parseFloat(s), alpha: 0, omega: 0 };
  }

  // A*e^(alpha*t), e^(alpha*t), e^t, e^(-2t), 3e^(2t), -e^t
  const expRe = /^(-?[\d.]*)e\^\(?(-?[\d.]*)\*?t\)?$/;
  const em = s.match(expRe);
  if (em) {
    const A     = em[1] === '' || em[1] === undefined ? 1 : (em[1] === '-' ? -1 : parseFloat(em[1]));
    const alpha = em[2] === '' || em[2] === undefined ? 1 : parseFloat(em[2]);
    return { type: 'exp', A: isNaN(A) ? 1 : A, alpha: isNaN(alpha) ? 1 : alpha, omega: 0 };
  }

  // A*sin(omega*t)
  const sinRe = /^(-?[\d.]*)\*?sin\((-?[\d.]*)\*?t\)$/;
  const sm = s.match(sinRe);
  if (sm) {
    const A = sm[1] === '' ? 1 : parseFloat(sm[1]);
    const w = sm[2] === '' ? 1 : parseFloat(sm[2]);
    return { type: 'sin', A: isNaN(A) ? 1 : A, alpha: 0, omega: isNaN(w) ? 1 : w };
  }

  // A*cos(omega*t)
  const cosRe = /^(-?[\d.]*)\*?cos\((-?[\d.]*)\*?t\)$/;
  const cm = s.match(cosRe);
  if (cm) {
    const A = cm[1] === '' ? 1 : parseFloat(cm[1]);
    const w = cm[2] === '' ? 1 : parseFloat(cm[2]);
    return { type: 'cos', A: isNaN(A) ? 1 : A, alpha: 0, omega: isNaN(w) ? 1 : w };
  }

  // t
  if (s === 't') return { type: 'poly1', A: 1, alpha: 0, omega: 0 };

  throw new Error(
    `Función forzante no reconocida: "${rhs}"\n` +
    `Soportadas: 0, constante, e^(a*t), sin(b*t), cos(b*t), t`
  );
}

// ─── LaTeX helpers ─────────────────────────────────────────────────────────

function forcingLatex({ type, A, alpha, omega }) {
  const a = fmtNum(A);
  switch (type) {
    case 'zero':     return '0';
    case 'constant': return a;
    case 'exp':      return `${A !== 1 ? a : ''}e^{${fmtNum(alpha)}t}`;
    case 'sin':      return `${A !== 1 ? a : ''}\\sin(${fmtNum(omega)}t)`;
    case 'cos':      return `${A !== 1 ? a : ''}\\cos(${fmtNum(omega)}t)`;
    case 'poly1':    return 't';
    default: return '?';
  }
}

function laplaceOfForcing({ type, A, alpha, omega }) {
  // Returns { latex, num: poly[], den: poly[] }  (rational in s)
  switch (type) {
    case 'zero':     return { latex: '0', num: [0], den: [1] };
    case 'constant': return { latex: `\\frac{${fmtNum(A)}}{s}`, num: [A], den: [1, 0] };
    case 'exp': {
      const tex = alpha === 0
        ? `\\frac{${fmtNum(A)}}{s}`
        : `\\frac{${fmtNum(A)}}{s ${alpha < 0 ? '+' : '-'} ${fmtNum(Math.abs(alpha))}}`;
      return { latex: tex, num: [A], den: [1, -alpha] };
    }
    case 'sin': {
      const w2 = omega * omega;
      return {
        latex: `\\frac{${fmtNum(A * omega)}}{s^2 + ${fmtNum(w2)}}`,
        num: [0, A * omega],
        den: [1, 0, w2],
      };
    }
    case 'cos': {
      const w2 = omega * omega;
      return {
        latex: `\\frac{${fmtNum(A)} s}{s^2 + ${fmtNum(w2)}}`,
        num: [A, 0],
        den: [1, 0, w2],
      };
    }
    case 'poly1': return { latex: `\\frac{${fmtNum(A)}}{s^2}`, num: [A], den: [1, 0, 0] };
    default: throw new Error('Tipo de forzante desconocido');
  }
}

// ─── Polynomial arithmetic ────────────────────────────────────────────────────

function polyMul(p1, p2) {
  const out = new Array(p1.length + p2.length - 1).fill(0);
  for (let i = 0; i < p1.length; i++)
    for (let j = 0; j < p2.length; j++)
      out[i + j] += p1[i] * p2[j];
  return out;
}

function polyAdd(p1, p2) {
  const len = Math.max(p1.length, p2.length);
  const a = [...Array(len - p1.length).fill(0), ...p1];
  const b = [...Array(len - p2.length).fill(0), ...p2];
  return a.map((v, i) => v + b[i]);
}

function evalPoly(poly, s) {
  return poly.reduce((acc, c) => acc * s + c, 0);
}

// ─── Root finder (Durand-Kerner) ──────────────────────────────────────────────

function findRoots(poly) {
  // Remove leading zeros
  let p = [...poly];
  while (p.length > 1 && Math.abs(p[0]) < 1e-12) p.shift();

  const n = p.length - 1;
  if (n <= 0) return [];

  // Monic polynomial
  const monic = p.map(c => c / p[0]);

  if (n === 1) {
    // ax + b => x = -b/a
    return [{ re: -monic[1], im: 0 }];
  }

  if (n === 2) {
    const [, b, c] = monic;
    const disc = b * b - 4 * c;
    if (disc >= 0) {
      return [
        { re: (-b + Math.sqrt(disc)) / 2, im: 0 },
        { re: (-b - Math.sqrt(disc)) / 2, im: 0 },
      ];
    } else {
      const re = -b / 2;
      const im = Math.sqrt(-disc) / 2;
      return [{ re, im }, { re, im: -im }];
    }
  }

  // General: Durand-Kerner
  const roots = Array.from({ length: n }, (_, k) => {
    const angle = 2 * Math.PI * k / n;
    const r = 0.4 + k * 0.1;
    return { re: r * Math.cos(angle), im: r * Math.sin(angle) };
  });

  for (let iter = 0; iter < 200; iter++) {
    for (let i = 0; i < n; i++) {
      const pval = cEvalPoly(monic, roots[i]);
      let denom = { re: 1, im: 0 };
      for (let j = 0; j < n; j++) {
        if (j !== i) denom = cMul(denom, cSub(roots[i], roots[j]));
      }
      const step = cDiv(pval, denom);
      roots[i] = cSub(roots[i], step);
    }
  }

  // Snap near-zero components to exact zero (numerical noise)
  const snapTol = 1e-7;
  for (const r of roots) {
    if (Math.abs(r.re) < snapTol) r.re = 0;
    if (Math.abs(r.im) < snapTol) r.im = 0;
  }

  return roots;
}

// Group roots by type: real simple, real repeated, complex conjugate pairs (simple or repeated)
function classifyRoots(roots) {
  const tol = 1e-5;
  const result = [];
  const used = new Array(roots.length).fill(false);

  for (let i = 0; i < roots.length; i++) {
    if (used[i]) continue;
    const r = roots[i];

    if (Math.abs(r.im) < tol) {
      // Real root — check for multiplicity
      let mult = 1;
      for (let j = i + 1; j < roots.length; j++) {
        if (!used[j] && Math.abs(roots[j].re - r.re) < tol && Math.abs(roots[j].im) < tol) {
          used[j] = true;
          mult++;
        }
      }
      result.push({ type: mult === 1 ? 'real' : 'repeated', re: r.re, im: 0, mult });
    } else if (r.im > tol) {
      // Complex root — find its conjugate
      let conjIdx = -1;
      for (let j = i + 1; j < roots.length; j++) {
        if (!used[j] && Math.abs(roots[j].re - r.re) < tol && Math.abs(roots[j].im + r.im) < tol) {
          conjIdx = j;
          break;
        }
      }
      if (conjIdx !== -1) used[conjIdx] = true;

      // Check if this complex pair repeats (look for another pair with same re,im)
      let mult = 1;
      for (let j = i + 1; j < roots.length; j++) {
        if (!used[j] && Math.abs(roots[j].re - r.re) < tol && Math.abs(Math.abs(roots[j].im) - r.im) < tol) {
          // Find its conjugate too
          for (let k = j + 1; k < roots.length; k++) {
            if (!used[k] && Math.abs(roots[k].re - r.re) < tol && Math.abs(roots[k].im + roots[j].im) < tol) {
              used[k] = true;
              break;
            }
          }
          used[j] = true;
          mult++;
        }
      }

      result.push({ type: mult === 1 ? 'complex' : 'complex_repeated', re: r.re, im: r.im, mult });
    }
    used[i] = true;
  }

  return result;
}

// ─── Complex arithmetic ───────────────────────────────────────────────────────

function cAdd(a, b) { return { re: a.re + b.re, im: a.im + b.im }; }
function cSub(a, b) { return { re: a.re - b.re, im: a.im - b.im }; }
function cMul(a, b) { return { re: a.re*b.re - a.im*b.im, im: a.re*b.im + a.im*b.re }; }
function cDiv(a, b) {
  const d = b.re*b.re + b.im*b.im;
  if (d < 1e-20) return { re: Infinity, im: 0 };
  return { re: (a.re*b.re + a.im*b.im)/d, im: (a.im*b.re - a.re*b.im)/d };
}
function cEvalPoly(poly, z) {
  return poly.reduce((acc, c) => cAdd(cMul(acc, z), { re: c, im: 0 }), { re: 0, im: 0 });
}

// ─── Residue calculation ──────────────────────────────────────────────────────

// Derivative of polynomial at z (complex)
function cPolyDeriv(poly, z) {
  // poly = [a_n, ..., a_0]  => p'(x) = sum k*a_k * x^(k-1)
  const n = poly.length - 1;
  const deriv = poly.slice(0, -1).map((c, i) => c * (n - i));
  return cEvalPoly(deriv, z);
}

// Residue of N(s)/D(s) at simple pole s=p
function residueSimple(num, den, p) {
  const N = cEvalPoly(num, p);
  const Dp = cPolyDeriv(den, p);
  return cDiv(N, Dp);
}

// Synthetic division: divide poly by (s - r), returns quotient
function syntheticDiv(poly, r) {
  const out = [poly[0]];
  for (let i = 1; i < poly.length - 1; i++)
    out.push(out[out.length - 1] * r + poly[i]);
  return out;
}

// For repeated complex pole p = α+iω (order 2):
// Contribution: [2Re(B1)cos + (-2Im(B1))sin]*e^(αt) + [2Re(B2)*t*cos + (-2Im(B2))*t*sin]*e^(αt)
function complexDoubleResidue(num, den, p) {
  // Use step h along REAL axis for finite differences.
  // Key: divide by h or h^2 as plain real scalars to avoid cDiv precision issues.
  const h = 1e-4;

  // Q2(p) = lim_{s→p} den(s)/(s-p)^2 = den''(p)/2
  // Using real-axis perturbation and scalar division:
  const pphR = { re: p.re + h, im: p.im };
  const pmhR = { re: p.re - h, im: p.im };

  const Dp   = cEvalPoly(den, p);
  const DphR = cEvalPoly(den, pphR);
  const DmhR = cEvalPoly(den, pmhR);

  // d²den/ds² ≈ [D(p+h) + D(p-h) - 2*D(p)] / h²  (scalar division)
  const D2 = {
    re: (DphR.re + DmhR.re - 2 * Dp.re) / (h * h),
    im: (DphR.im + DmhR.im - 2 * Dp.im) / (h * h),
  };
  // Q2(p) = D2 / 2
  const Q2p = { re: D2.re / 2, im: D2.im / 2 };

  const Np = cEvalPoly(num, p);
  const B2 = cDiv(Np, Q2p);

  // f(z) = N(z) / Q2(z) where Q2(z) = den(z)/(z-p)^2
  // Near z = p+h (h real): (z-p)^2 = h^2 (real scalar)
  const fAt = z => {
    const sp = cSub(z, p);           // z - p
    const sp2 = cMul(sp, sp);        // (z-p)^2 as complex
    const dz  = cEvalPoly(den, z);
    const Nz  = cEvalPoly(num, z);
    const q2z = cDiv(dz, sp2);       // den(z)/(z-p)^2
    return cDiv(Nz, q2z);
  };

  const fphR = fAt(pphR);
  const fmhR = fAt(pmhR);

  // B1 = df/ds at p  (scalar division by 2h)
  const B1 = {
    re: (fphR.re - fmhR.re) / (2 * h),
    im: (fphR.im - fmhR.im) / (2 * h),
  };

  return { B2, B1 };
}

// For double pole: N(s)/D(s) = A/(s-p)^2 + B/(s-p) + ...
// Multiply by (s-p)^2 and call it Q(s) = N(s) / [D(s)/(s-p)^2]
// B = Q(p),  A = Q'(p)
function residueDouble(num, den, p) {
  // Remove (s-p)^2 from den by dividing twice
  const d1 = syntheticDiv(den, p);   // remove one (s-p)
  const d2 = syntheticDiv(d1, p);    // remove another (s-p)
  const B = evalPoly(num, p) / evalPoly(d2, p);

  // A = d/ds [ N(s)/Q2(s) ] at s=p
  const h = 1e-5;
  const Qh = x => evalPoly(num, x) / evalPoly(d2, x);
  const A = (Qh(p + h) - Qh(p - h)) / (2 * h);
  return { A, B };
}

// ─── Main Solver ──────────────────────────────────────────────────────────────

export function solveODE(equation, y0, dy0) {
  const parsed = parseODE(equation);
  const { order, a2, a1, a0, forcing } = parsed;
  const steps = [];

  // ── Step 1: Original equation ──
  const odeLatex = buildODELatex(parsed);
  steps.push({
    title: 'Ecuación Original',
    latex: odeLatex,
    description: `Ecuación diferencial de ${order}° orden con condiciones: y(0)=${y0}${order === 2 ? `, y'(0)=${dy0}` : ''}`
  });

  // ── Step 2: Apply L{} to both sides ──
  const lhsTransform = buildLHSTransformLatex(parsed, y0, dy0);
  const lF = laplaceOfForcing(forcing);
  steps.push({
    title: 'Transformada de Laplace — Definición',
    latex: `\\mathcal{L}\\left\\{${odeLatex}\\right\\}`,
    description: 'Aplicamos la transformada de Laplace a ambos lados de la ecuación.'
  });

  // ── Step 3: Expand using transform rules ──
  steps.push({
    title: 'Aplicar Reglas de Transformación',
    latex: `${lhsTransform} = ${lF.latex}`,
    description: order === 2
      ? '\\(\\mathcal{L}\\{y\'\'\\} = s^2Y(s) - sy(0) - y\'(0)\\) y \\(\\mathcal{L}\\{y\'\\} = sY(s) - y(0)\\)'
      : '\\(\\mathcal{L}\\{y\'\\} = sY(s) - y(0)\\)'
  });

  // ── Step 4: Solve for Y(s) ──
  // Compute num and den polynomials of Y(s)
  // char poly from LHS:  order2: [a2, a1, a0], order1: [a1, a0]
  const charPoly = order === 2 ? [a2, a1, a0] : [a1, a0];

  // IC contribution: order1: a1*y0; order2: a2*(s*y0+dy0) + a1*y0
  let icNum;
  if (order === 2) {
    icNum = [a2 * y0, a2 * dy0 + a1 * y0];
  } else {
    icNum = [a1 * y0];
  }

  // Y(s) = [F_num + icNum * fDen] / [charPoly * fDen]
  const fDen = lF.den;
  const fNum = lF.num;

  const totalNum = polyAdd(fNum, polyMul(icNum, fDen));
  const totalDen = polyMul(charPoly, fDen);

  const YsLatex = buildYsLatex(totalNum, totalDen, parsed, y0, dy0, lF);
  steps.push({
    title: 'Despejar Y(s)',
    latex: YsLatex,
    description: 'Agrupamos los términos con Y(s) en un lado y despejamos.'
  });

  // ── Step 5: Partial fractions + inverse Laplace ──
  const solution = invertLaplace(totalNum, totalDen, steps);

  return { steps, solution, parsed };
}

// ─── LaTeX builders ───────────────────────────────────────────────────────────

function buildODELatex({ order, a2, a1, a0, forcing }) {
  const parts = [];
  if (order === 2 && Math.abs(a2) > 1e-9) {
    const c = Math.abs(a2) === 1 ? '' : fmtNum(Math.abs(a2));
    parts.push((a2 < 0 ? '-' : '') + c + "y''");
  }
  if (Math.abs(a1) > 1e-9) {
    const c = Math.abs(a1) === 1 ? '' : fmtNum(Math.abs(a1));
    if (parts.length) parts.push((a1 < 0 ? '- ' : '+ ') + c + "y'");
    else parts.push((a1 < 0 ? '-' : '') + c + "y'");
  }
  if (Math.abs(a0) > 1e-9) {
    const c = Math.abs(a0) === 1 ? '' : fmtNum(Math.abs(a0));
    if (parts.length) parts.push((a0 < 0 ? '- ' : '+ ') + c + 'y');
    else parts.push((a0 < 0 ? '-' : '') + c + 'y');
  }
  return parts.join(' ') + ' = ' + forcingLatex(forcing);
}

function buildLHSTransformLatex({ order, a2, a1, a0 }, y0, dy0) {
  const parts = [];
  if (order === 2 && Math.abs(a2) > 1e-9) {
    const c = Math.abs(a2) === 1 ? '' : fmtNum(Math.abs(a2));
    const y0s = y0 !== 0 ? ` - ${fmtNum(y0)}s` : '';
    const dy0s = dy0 !== 0 ? ` - ${fmtNum(dy0)}` : '';
    parts.push(`${a2 < 0 ? '-' : ''}${c}(s^2 Y(s)${y0s}${dy0s})`);
  }
  if (Math.abs(a1) > 1e-9) {
    const c = Math.abs(a1) === 1 ? '' : fmtNum(Math.abs(a1));
    const y0s = y0 !== 0 ? ` - ${fmtNum(y0)}` : '';
    if (parts.length) parts.push(`${a1 < 0 ? '-' : '+'} ${c}(sY(s)${y0s})`);
    else parts.push(`${a1 < 0 ? '-' : ''}${c}(sY(s)${y0s})`);
  }
  if (Math.abs(a0) > 1e-9) {
    const c = Math.abs(a0) === 1 ? '' : fmtNum(Math.abs(a0));
    if (parts.length) parts.push(`${a0 < 0 ? '-' : '+'} ${c}Y(s)`);
    else parts.push(`${a0 < 0 ? '-' : ''}${c}Y(s)`);
  }
  return parts.join(' ');
}

function buildYsLatex(num, den, parsed, y0, dy0, lF) {
  const { order, a2, a1, a0 } = parsed;

  // Build a readable form of charPoly*fDen denominator
  const charStr = order === 2
    ? buildPolyLatex([a2, a1, a0], 's')
    : buildPolyLatex([a1, a0], 's');

  const denStr = lF.den.length > 1
    ? `(${charStr})(${buildPolyLatex(lF.den, 's')})`
    : charStr;

  // Build numerator
  let icContrib = '';
  if (order === 2) {
    const cs = a2 * y0;
    const cc = a2 * dy0 + a1 * y0;
    const terms = [];
    if (Math.abs(cs) > 1e-9) terms.push(`${fmtNum(cs)}s`);
    if (Math.abs(cc) > 1e-9) terms.push(fmtNum(cc));
    icContrib = terms.join(' + ');
  } else {
    const c = a1 * y0;
    if (Math.abs(c) > 1e-9) icContrib = fmtNum(c);
  }

  const numStr = icContrib && lF.latex !== '0'
    ? `${lF.latex} + ${icContrib}`
    : (icContrib || (lF.latex === '0' ? '0' : lF.latex));

  // If numerator/denominator share fDen factors, simplify display
  if (lF.den.length === 1) {
    return `Y(s) = \\frac{${numStr}}{${charStr}}`;
  }
  return `Y(s) = \\frac{${lF.latex} \\cdot (${charStr}) + ${icContrib || '0'}}{(${charStr}) \\cdot (${buildPolyLatex(lF.den, 's')})}`;
}

function buildPolyLatex(poly, varName) {
  const n = poly.length - 1;
  const parts = [];
  poly.forEach((c, i) => {
    if (Math.abs(c) < 1e-9) return;
    const power = n - i;
    const varStr = power === 0 ? '' : power === 1 ? varName : `${varName}^${power}`;
    const absC = Math.abs(c);
    const coeffStr = absC === 1 && power > 0 ? '' : fmtNum(absC);
    const sign = c < 0 ? '-' : '+';
    parts.push({ sign: c < 0 ? '-' : '+', str: coeffStr + varStr });
  });
  if (!parts.length) return '0';
  return parts.map((p, i) =>
    i === 0 ? (p.sign === '-' ? '-' + p.str : p.str) : p.sign + ' ' + p.str
  ).join(' ');
}

// ─── Inverse Laplace via partial fractions ────────────────────────────────────

function invertLaplace(num, den, steps) {
  const rawRoots = findRoots(den);
  const poles = classifyRoots(rawRoots);

  const terms = [];
  const pfParts = [];

  for (const pole of poles) {
    if (pole.type === 'real') {
      const p = { re: pole.re, im: 0 };
      const A = residueSimple(num, den, p);
      const Aval = A.re; // should be real

      if (Math.abs(Aval) < 1e-8) continue;

      const poleStr = Math.abs(pole.re) < 1e-9
        ? 's'
        : `s ${pole.re < 0 ? '+' : '-'} ${fmtNum(Math.abs(pole.re))}`;

      pfParts.push(`\\frac{${fmtNum(Aval)}}{${poleStr}}`);

      const expLatex = fmtExpTerm(Aval, pole.re) || '0';

      terms.push({
        latex: expLatex,
        evaluate: t => Aval * Math.exp(pole.re * t),
      });
    }

    else if (pole.type === 'repeated') {
      const { A, B } = residueDouble(num, den, pole.re);

      const poleStr = Math.abs(pole.re) < 1e-9
        ? 's'
        : `s ${pole.re < 0 ? '+' : '-'} ${fmtNum(Math.abs(pole.re))}`;

      // A = coeff of 1/(s-p)   → inverse Laplace: A * e^(pt)
      // B = coeff of 1/(s-p)^2 → inverse Laplace: B * t * e^(pt)
      if (Math.abs(A) > 1e-8)
        pfParts.push(`\\frac{${fmtNum(A)}}{${poleStr}}`);
      if (Math.abs(B) > 1e-8)
        pfParts.push(`\\frac{${fmtNum(B)}}{(${poleStr})^2}`);

      const expPart2 = Math.abs(pole.re) < 1e-9 ? '' :
        (Math.abs(Math.abs(pole.re) - 1) < 1e-9 ? `e^{${pole.re < 0 ? '-' : ''}t}` : `e^{${fmtNum(pole.re)}t}`);
      const Bstr = Math.abs(Math.abs(B) - 1) < 1e-9 ? (B < 0 ? '-' : '') : fmtNum(B);
      const tl = [
        Math.abs(A) > 1e-8 ? (fmtExpTerm(A, pole.re) || '0') : null,
        Math.abs(B) > 1e-8 ? `${Bstr}t${expPart2}` : null,
      ].filter(Boolean).join(' + ');

      terms.push({
        latex: tl || '0',
        evaluate: t => A * Math.exp(pole.re * t) + B * t * Math.exp(pole.re * t),
      });
    }

    else if (pole.type === 'complex') {
      const alpha = pole.re;
      const omega = Math.abs(pole.im);
      const p = { re: alpha, im: omega };

      const A = residueSimple(num, den, p);
      const cosC = 2 * A.re;
      const sinC = -2 * A.im;

      const pfDen = Math.abs(alpha) < 1e-9
        ? `s^2 + ${fmtNum(omega * omega)}`
        : `(s ${alpha < 0 ? '+' : '-'} ${fmtNum(Math.abs(alpha))})^2 + ${fmtNum(omega * omega)}`;

      if (Math.abs(cosC) > 1e-8)
        pfParts.push(`\\frac{${fmtNum(cosC)} s}{${pfDen}}`);

      const termParts = [];
      if (Math.abs(cosC) > 1e-8)
        termParts.push(fmtTrigExpTerm(cosC, alpha, omega, '\\cos') || '');
      if (Math.abs(sinC) > 1e-8)
        termParts.push(fmtTrigExpTerm(sinC, alpha, omega, '\\sin') || '');

      if (!termParts.length) continue;

      terms.push({
        latex: termParts.join(' + ').replace(/\+\s*-/g, '- '),
        evaluate: t =>
          cosC * Math.exp(alpha * t) * Math.cos(omega * t) +
          sinC * Math.exp(alpha * t) * Math.sin(omega * t),
      });
    }

    else if (pole.type === 'complex_repeated') {
      // Repeated complex poles: p = alpha ± i*omega  (multiplicity 2)
      // Y(s) = B2/(s-p)^2 + B1/(s-p) + conj terms
      // Contribution: [2Re(B1)*cos + (-2Im(B1))*sin]*e^(αt)
      //             + [2Re(B2)*t*cos + (-2Im(B2))*t*sin]*e^(αt)
      const alpha = pole.re;
      const omega = Math.abs(pole.im);
      const p = { re: alpha, im: omega };

      // Remove (s-p)^2 and (s-p*)^2 from denominator to find Q(s)
      // den = (s-p)^2 (s-p*)^2 * R(s)
      // Divide by (s-p)^2 numerically using complex synthetic division twice
      const { B2, B1 } = complexDoubleResidue(num, den, p);

      const cosC1 = 2 * B1.re, sinC1 = -2 * B1.im;
      const cosC2 = 2 * B2.re, sinC2 = -2 * B2.im;

      const termParts = [];
      if (Math.abs(cosC1) > 1e-8) termParts.push(fmtTrigExpTerm(cosC1, alpha, omega, '\\cos') || '');
      if (Math.abs(sinC1) > 1e-8) termParts.push(fmtTrigExpTerm(sinC1, alpha, omega, '\\sin') || '');
      if (Math.abs(cosC2) > 1e-8) termParts.push(fmtTrigExpTerm(cosC2, alpha, omega, '\\cos', true) || '');
      if (Math.abs(sinC2) > 1e-8) termParts.push(fmtTrigExpTerm(sinC2, alpha, omega, '\\sin', true) || '');

      if (!termParts.length) continue;

      pfParts.push(`\\frac{\\cdots}{(${buildPolyLatex([1, 0, omega * omega], 's')})^2}`);

      terms.push({
        latex: termParts.join(' + ').replace(/\+\s*-/g, '- '),
        evaluate: t =>
          cosC1 * Math.exp(alpha * t) * Math.cos(omega * t) +
          sinC1 * Math.exp(alpha * t) * Math.sin(omega * t) +
          cosC2 * t * Math.exp(alpha * t) * Math.cos(omega * t) +
          sinC2 * t * Math.exp(alpha * t) * Math.sin(omega * t),
      });
    }
  }

  const pfLatex = pfParts.length
    ? 'Y(s) = ' + pfParts.join(' + ').replace(/\+\s*-/g, '- ')
    : 'Y(s) = 0';

  steps.push({
    title: 'Descomposición en Fracciones Parciales',
    latex: pfLatex,
    description: 'Descomponemos Y(s) en fracciones simples para aplicar la transformada inversa.'
  });

  const solutionLatex = terms.length
    ? 'y(t) = ' + terms.map(t => t.latex).join(' + ').replace(/\+\s*-/g, '- ')
    : 'y(t) = 0';

  steps.push({
    title: 'Solución: Transformada Inversa de Laplace',
    latex: solutionLatex,
    description: 'Aplicamos \\(\\mathcal{L}^{-1}\\) a cada fracción usando la tabla de transformadas.'
  });

  const evaluate = t => terms.reduce((s, term) => s + term.evaluate(t), 0);

  return { latex: solutionLatex, terms, evaluate };
}
