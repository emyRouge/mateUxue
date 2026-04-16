import { useState, useEffect, useRef } from 'react';
import katex from 'katex';
import InputForm from './components/InputForm';
import ResultsPanel from './components/ResultsPanel';
import { solveODE } from './lib/laplaceEngine';

function KatexSpan({ latex }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      try {
        katex.render(latex, ref.current, { displayMode: false, throwOnError: false, strict: false });
      } catch {
        ref.current.textContent = latex;
      }
    }
  }, [latex]);
  return <span ref={ref} className="text-slate-300" />;
}

const TRANSFORM_TABLE = [
  ['\\mathcal{L}\\{1\\}', '\\tfrac{1}{s}'],
  ['\\mathcal{L}\\{e^{at}\\}', '\\tfrac{1}{s-a}'],
  ['\\mathcal{L}\\{\\sin(\\omega t)\\}', '\\tfrac{\\omega}{s^2+\\omega^2}'],
  ['\\mathcal{L}\\{\\cos(\\omega t)\\}', '\\tfrac{s}{s^2+\\omega^2}'],
  ['\\mathcal{L}\\{t\\}', '\\tfrac{1}{s^2}'],
  ["\\mathcal{L}\\{y'\\}", 'sY(s)-y_0'],
  ["\\mathcal{L}\\{y''\\}", 's^2Y(s)-sy_0-y_1'],
];

export default function App() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastInput, setLastInput] = useState({ equation: '', y0: 0, dy0: 0 });

  function handleSolve(equation, y0, dy0) {
    setLoading(true);
    setError('');
    setResult(null);

    setTimeout(() => {
      try {
        const res = solveODE(equation, y0, dy0);
        setResult(res);
        setLastInput({ equation, y0, dy0 });
      } catch (e) {
        setError(e.message || 'Error desconocido al resolver la ecuación.');
      } finally {
        setLoading(false);
      }
    }, 50);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 7h16M4 12h16M4 17h7" />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">
              Solucionador EDOs — Transformada de Laplace
            </h1>
            <p className="text-slate-400 text-xs">Primer y segundo orden · Paso a paso · Gráfica</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Left: Input + Reference ── */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 space-y-4">
              <InputForm onSolve={handleSolve} loading={loading} />

              {/* Transform reference table */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
                <h3 className="text-slate-300 font-semibold text-sm mb-3">
                  Tabla de Transformadas
                </h3>
                <div className="space-y-1">
                  {TRANSFORM_TABLE.map(([lhs, rhs], i) => (
                    <div key={i} className="flex items-center gap-2 py-1 border-b border-slate-700/30 last:border-0 text-xs">
                      <KatexSpan latex={lhs} />
                      <span className="text-slate-600 mx-1">→</span>
                      <KatexSpan latex={rhs} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Results ── */}
          <div className="lg:col-span-3">
            {error && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-2xl p-5 mb-6">
                <p className="text-red-300 font-semibold text-sm mb-1">Error al resolver</p>
                <p className="text-red-400 text-sm">{error}</p>
                <p className="text-slate-500 text-xs mt-2">
                  Formato válido: <code className="text-slate-400">y' + 2y = 0</code>,{' '}
                  <code className="text-slate-400">y'' + y = sin(1*t)</code>,{' '}
                  <code className="text-slate-400">y' - y = e^(1*t)</code>
                </p>
              </div>
            )}

            {!result && !error && !loading && (
              <EmptyState />
            )}

            {loading && (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 border border-slate-700/40 rounded-2xl bg-slate-800/20">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm">Aplicando Transformada de Laplace…</p>
              </div>
            )}

            {result && !loading && (
              <ResultsPanel
                result={result}
                equation={lastInput.equation}
                y0={lastInput.y0}
                dy0={lastInput.dy0}
              />
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800 mt-16 py-6 text-center text-slate-600 text-xs">
        Solucionador de EDOs por Transformada de Laplace · Ecuaciones Diferenciales 8A
      </footer>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-64 flex flex-col items-center justify-center text-slate-500 border border-slate-700/40 rounded-2xl bg-slate-800/20 gap-3">
      <svg className="w-12 h-12 opacity-25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 7h16M4 12h16M4 17h7" />
      </svg>
      <p className="text-sm">
        Ingresa una ecuación y presiona{' '}
        <span className="text-indigo-400 font-medium">Resolver</span>
      </p>
      <p className="text-xs text-slate-600">
        O selecciona un caso rápido del panel izquierdo
      </p>
    </div>
  );
}
