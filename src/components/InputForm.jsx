import { useState } from 'react';

const QUICK_CASES = [
  { label: "y' + 2y = 0", eq: "y' + 2y = 0", y0: 1, dy0: 0 },
  { label: "y'' + 3y' + 2y = 0", eq: "y'' + 3y' + 2y = 0", y0: 0, dy0: 1 },
  { label: "y' - y = e^t", eq: "y' - y = e^(1*t)", y0: 1, dy0: 0 },
  { label: "y'' + y = sin(t)", eq: "y'' + y = sin(1*t)", y0: 0, dy0: 0 },
];

export default function InputForm({ onSolve, loading }) {
  const [equation, setEquation] = useState("y' + 2y = 0");
  const [y0, setY0] = useState('1');
  const [dy0, setDy0] = useState('0');
  const [order, setOrder] = useState(1);
  const [error, setError] = useState('');

  function handleQuick(c) {
    setEquation(c.eq);
    setY0(String(c.y0));
    setDy0(String(c.dy0));
    const hasSecond = /y''|y"/.test(c.eq);
    setOrder(hasSecond ? 2 : 1);
    setError('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const y0val = parseFloat(y0);
    const dy0val = parseFloat(dy0);
    if (isNaN(y0val)) { setError('y(0) debe ser un número'); return; }
    if (order === 2 && isNaN(dy0val)) { setError("y'(0) debe ser un número"); return; }
    if (!equation.trim()) { setError('Ingresa una ecuación'); return; }
    onSolve(equation.trim(), y0val, dy0val);
  }

  const hasSecond = /y''|y"/.test(equation);

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6">
      <h2 className="text-xl font-semibold text-white mb-4">Ecuación Diferencial</h2>

      {/* Quick cases */}
      <div className="mb-5">
        <p className="text-slate-400 text-sm mb-2">Casos rápidos:</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_CASES.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => handleQuick(c)}
              className="px-3 py-1.5 text-xs bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/40 text-indigo-300 rounded-lg transition-colors cursor-pointer"
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Equation input */}
        <div>
          <label className="block text-sm text-slate-300 mb-1">
            Ecuación diferencial
          </label>
          <input
            type="text"
            value={equation}
            onChange={e => { setEquation(e.target.value); setError(''); }}
            placeholder="ej: y'' + 4y' + 4y = 0"
            className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2.5 font-mono text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <p className="text-slate-500 text-xs mt-1">
            Usa y', y'' para derivadas. RHS: 0, constante, e^(a*t), sin(b*t), cos(b*t), t, t^2, 4*t^3 … (x se mapea a t)
          </p>
        </div>

        {/* Initial conditions */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-300 mb-1">y(0)</label>
            <input
              type="number"
              value={y0}
              onChange={e => setY0(e.target.value)}
              step="any"
              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2.5 font-mono text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          {hasSecond && (
            <div>
              <label className="block text-sm text-slate-300 mb-1">y'(0)</label>
              <input
                type="number"
                value={dy0}
                onChange={e => setDy0(e.target.value)}
                step="any"
                className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2.5 font-mono text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors cursor-pointer"
        >
          {loading ? 'Calculando...' : 'Resolver con Transformada de Laplace'}
        </button>
      </form>
    </div>
  );
}
