"""
Backend Python — Solucionador de EDOs por Transformada de Laplace
Usa FastAPI + SymPy para resolver ecuaciones diferenciales de 1er y 2do orden.
"""

import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sympy import (
    symbols, Function, exp, sin, cos, solve, simplify, apart,
    latex, S, Float, Heaviside, Rational, Integer
)
from sympy.integrals.transforms import inverse_laplace_transform, laplace_transform
from sympy.printing.pycode import PythonCodePrinter

# ── Símbolos globales ──────────────────────────────────────────────────────────
t, s = symbols('t s', positive=True)

app = FastAPI(title="Solucionador EDOs — Transformada de Laplace")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Modelos ────────────────────────────────────────────────────────────────────

class ODERequest(BaseModel):
    equation: str
    y0: float
    dy0: float = 0.0


# ── Parser ─────────────────────────────────────────────────────────────────────

def parse_ode(equation_str: str):
    """
    Parsea la cadena de la ecuación diferencial.
    Retorna: (order, a2, a1, a0, f_sym)
      donde a2*y'' + a1*y' + a0*y = f_sym
    """
    if "=" not in equation_str:
        raise ValueError("La ecuación necesita el signo '='")

    lhs, rhs = equation_str.split("=", 1)
    lhs = lhs.strip()
    rhs = rhs.strip()

    has_second = bool(re.search(r"y''|y\"", lhs))
    has_first  = bool(re.search(r"y'(?!')|dy", lhs))
    order = 2 if has_second else (1 if has_first else 0)

    if order == 0:
        raise ValueError("No se detectó ninguna derivada (y' o y'')")

    def extract_coeff(expr: str, pattern: str) -> float:
        m = re.search(pattern, expr)
        if not m:
            return 0.0
        raw = m.group(1).replace(" ", "")
        if raw in ("", "+"):
            return 1.0
        if raw == "-":
            return -1.0
        try:
            return float(raw)
        except ValueError:
            return 1.0

    a2 = extract_coeff(lhs, r"([+-]?\s*[\d.]*)\s*\*?\s*y''") if has_second else 0.0
    a1 = extract_coeff(lhs, r"([+-]?\s*[\d.]*)\s*\*?\s*y'(?!')")
    a0 = extract_coeff(lhs, r"([+-]?\s*[\d.]*)\s*\*?\s*y(?!')")

    f_sym = parse_forcing(rhs)
    return order, float(a2), float(a1), float(a0), f_sym


def parse_forcing(rhs: str):
    """Convierte el lado derecho de la ecuación en una expresión SymPy."""
    r = rhs.strip().replace(" ", "")

    if r in ("0", ""):
        return S.Zero

    # Constante pura
    if re.match(r"^-?[\d.]+$", r):
        return Float(r)

    # e^(alpha*t) o e^t
    m = re.match(r"^(-?[\d.]*)e\^\(?(-?[\d.]*)\*?t\)?$", r)
    if m:
        A_str, alpha_str = m.group(1), m.group(2)
        A = 1.0 if A_str in ("", "+") else (-1.0 if A_str == "-" else float(A_str))
        alpha = 1.0 if alpha_str in ("", "+") else float(alpha_str)
        return Float(A) * exp(Float(alpha) * t)

    # A*sin(omega*t)
    m = re.match(r"^(-?[\d.]*)\*?sin\((-?[\d.]*)\*?t\)$", r)
    if m:
        A = 1.0 if m.group(1) in ("", "+") else float(m.group(1))
        w = 1.0 if m.group(2) in ("", "+") else float(m.group(2))
        return Float(A) * sin(Float(w) * t)

    # A*cos(omega*t)
    m = re.match(r"^(-?[\d.]*)\*?cos\((-?[\d.]*)\*?t\)$", r)
    if m:
        A = 1.0 if m.group(1) in ("", "+") else float(m.group(1))
        w = 1.0 if m.group(2) in ("", "+") else float(m.group(2))
        return Float(A) * cos(Float(w) * t)

    # t
    if r == "t":
        return t

    raise ValueError(
        f"Función forzante no reconocida: '{rhs}'. "
        "Soportadas: 0, constante, e^(a*t), sin(b*t), cos(b*t), t"
    )


# ── Helpers LaTeX ──────────────────────────────────────────────────────────────

def fmt(n: float) -> str:
    """Formatea número como int si es entero."""
    return str(int(n)) if n == int(n) else str(n)


def build_ode_latex(order: int, a2: float, a1: float, a0: float, f_sym) -> str:
    parts = []
    if order == 2 and abs(a2) > 1e-9:
        c = "" if abs(a2) == 1 else fmt(abs(a2))
        parts.append(("-" if a2 < 0 else "") + c + "y''")
    if abs(a1) > 1e-9:
        c = "" if abs(a1) == 1 else fmt(abs(a1))
        sign = "- " if a1 < 0 else ("+ " if parts else "")
        parts.append(sign + c + "y'")
    if abs(a0) > 1e-9:
        c = "" if abs(a0) == 1 else fmt(abs(a0))
        sign = "- " if a0 < 0 else ("+ " if parts else "")
        parts.append(sign + c + "y")
    return " ".join(parts) + " = " + latex(f_sym)


def build_lhs_transform_latex(order: int, a2: float, a1: float, a0: float,
                               y0: float, dy0: float) -> str:
    parts = []
    if order == 2 and abs(a2) > 1e-9:
        c = "" if abs(a2) == 1 else fmt(abs(a2))
        y0s  = f" - {fmt(y0)}s" if y0 != 0 else ""
        dy0s = f" - {fmt(dy0)}" if dy0 != 0 else ""
        sign = "-" if a2 < 0 else ""
        parts.append(f"{sign}{c}(s^2 Y(s){y0s}{dy0s})")
    if abs(a1) > 1e-9:
        c = "" if abs(a1) == 1 else fmt(abs(a1))
        y0s  = f" - {fmt(y0)}" if y0 != 0 else ""
        sign = "- " if a1 < 0 else ("+ " if parts else "")
        parts.append(f"{sign}{c}(sY(s){y0s})")
    if abs(a0) > 1e-9:
        c = "" if abs(a0) == 1 else fmt(abs(a0))
        sign = "- " if a0 < 0 else ("+ " if parts else "")
        parts.append(f"{sign}{c}Y(s)")
    return " ".join(parts)


# ── Conversión SymPy → JS ──────────────────────────────────────────────────────

def sympy_to_js(expr) -> str:
    """
    Convierte una expresión SymPy en una cadena evaluable en JavaScript.
    Sustituye Heaviside(t) = 1 (válido para t ≥ 0) y adapta notación.
    """
    expr = expr.subs(Heaviside(t), 1)
    expr = simplify(expr)

    printer = PythonCodePrinter()
    py_str = printer.doprint(expr)

    # Python math → JavaScript Math
    js_str = (
        py_str
        .replace("math.exp",  "Math.exp")
        .replace("math.sin",  "Math.sin")
        .replace("math.cos",  "Math.cos")
        .replace("math.sqrt", "Math.sqrt")
        .replace("math.log",  "Math.log")
        .replace("math.tan",  "Math.tan")
        .replace("math.pi",   "Math.PI")
    )
    return js_str


# ── Endpoint principal ─────────────────────────────────────────────────────────

@app.post("/solve")
def solve_ode(req: ODERequest):
    """
    Resuelve una EDO de 1er o 2do orden usando Transformada de Laplace con SymPy.

    Flujo:
      1. Ecuación original
      2. Aplicar L{}
      3. Expandir usando reglas de transformación
      4. Despejar Y(s)
      5. Fracciones parciales
      6. Transformada inversa → y(t)
    """
    try:
        order, a2, a1, a0, f_sym = parse_ode(req.equation)
        y0_val  = req.y0
        dy0_val = req.dy0
        steps   = []

        # ── Paso 1: Ecuación original ──────────────────────────────────────────
        ode_latex = build_ode_latex(order, a2, a1, a0, f_sym)
        steps.append({
            "title": "Ecuación Original",
            "latex": ode_latex,
            "description": (
                f"Ecuación diferencial de {order}° orden con condiciones: "
                f"y(0)={fmt(y0_val)}"
                + (f", y'(0)={fmt(dy0_val)}" if order == 2 else "")
            ),
        })

        # ── Paso 2: Definición de la Transformada de Laplace ──────────────────
        steps.append({
            "title": "Transformada de Laplace — Definición",
            "latex": f"\\mathcal{{L}}\\left\\{{{ode_latex}\\right\\}}",
            "description": "Aplicamos la transformada de Laplace a ambos lados de la ecuación.",
        })

        # ── Paso 3: Aplicar reglas ─────────────────────────────────────────────
        F_s = laplace_transform(f_sym, t, s, noconds=True)
        F_s = simplify(F_s)

        lhs_tx = build_lhs_transform_latex(order, a2, a1, a0, y0_val, dy0_val)
        steps.append({
            "title": "Aplicar Reglas de Transformación",
            "latex": f"{lhs_tx} = {latex(F_s)}",
            "description": (
                "\\(\\mathcal{L}\\{y''\\} = s^2Y(s) - sy(0) - y'(0)\\) "
                "y \\(\\mathcal{L}\\{y'\\} = sY(s) - y(0)\\)"
                if order == 2 else
                "\\(\\mathcal{L}\\{y'\\} = sY(s) - y(0)\\)"
            ),
        })

        # ── Paso 4: Despejar Y(s) ─────────────────────────────────────────────
        Y = symbols("Y_s")
        if order == 2:
            lhs_eq = (
                a2 * (s**2 * Y - s * y0_val - dy0_val)
                + a1 * (s * Y - y0_val)
                + a0 * Y
            )
        else:
            lhs_eq = a1 * (s * Y - y0_val) + a0 * Y

        sols = solve(lhs_eq - F_s, Y)
        if not sols:
            raise ValueError("No se pudo despejar Y(s). Revisa los coeficientes.")
        Y_sol = simplify(sols[0])

        steps.append({
            "title": "Despejar Y(s)",
            "latex": "Y(s) = " + latex(Y_sol),
            "description": "Agrupamos los términos con Y(s) en un lado y despejamos.",
        })

        # ── Paso 5: Fracciones parciales ──────────────────────────────────────
        Y_pf = apart(Y_sol, s)
        steps.append({
            "title": "Descomposición en Fracciones Parciales",
            "latex": "Y(s) = " + latex(Y_pf),
            "description": (
                "Descomponemos Y(s) en fracciones simples para aplicar "
                "la transformada inversa."
            ),
        })

        # ── Paso 6: Transformada inversa → y(t) ───────────────────────────────
        y_t = inverse_laplace_transform(Y_sol, s, t)
        y_t = simplify(y_t)

        solution_latex = "y(t) = " + latex(y_t)
        steps.append({
            "title": "Solución: Transformada Inversa de Laplace",
            "latex": solution_latex,
            "description": (
                "Aplicamos \\(\\mathcal{L}^{-1}\\) a cada fracción "
                "usando la tabla de transformadas."
            ),
        })

        # ── Expresión evaluable en JS ──────────────────────────────────────────
        solution_expr = sympy_to_js(y_t)

        return {
            "steps": steps,
            "solution_latex": solution_latex,
            "solution_expr": solution_expr,
            "order": order,
        }

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error interno: {exc}")


@app.get("/health")
def health():
    return {"status": "ok", "engine": "sympy"}
