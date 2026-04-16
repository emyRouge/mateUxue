import { useEffect, useRef, useState } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend, Filler);

export default function GraphViewer({ evaluate, solutionLatex }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [tMin, setTMin] = useState(0);
  const [tMax, setTMax] = useState(5);
  const [points, setPoints] = useState(200);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!evaluate || !canvasRef.current) return;
    renderChart();
  }, [evaluate, tMin, tMax, points]);

  useEffect(() => {
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, []);

  function renderChart() {
    setError('');
    try {
      const n = Math.max(50, Math.min(1000, Number(points)));
      const t0 = Number(tMin);
      const t1 = Number(tMax);
      if (t1 <= t0) { setError('tMax debe ser mayor que tMin'); return; }

      const labels = [];
      const data = [];
      const step = (t1 - t0) / n;

      for (let i = 0; i <= n; i++) {
        const t = t0 + i * step;
        labels.push(t.toFixed(3));
        const y = evaluate(t);
        data.push(isFinite(y) ? Math.max(-1e6, Math.min(1e6, y)) : null);
      }

      const existing = Chart.getChart(canvasRef.current);
      if (existing) {
        existing.destroy();
      }
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }

      const ctx = canvasRef.current.getContext('2d');
      chartRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'y(t)',
            data,
            borderColor: '#818cf8',
            backgroundColor: 'rgba(129,140,248,0.08)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4,
            fill: true,
            spanGaps: true,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 400 },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: '#94a3b8' } },
            tooltip: {
              backgroundColor: 'rgba(15,23,42,0.95)',
              titleColor: '#c7d2fe',
              bodyColor: '#e2e8f0',
              borderColor: '#4f46e5',
              borderWidth: 1,
              callbacks: {
                title: items => `t = ${items[0].label}`,
                label: item => `y(t) = ${Number(item.raw).toFixed(6)}`,
              }
            }
          },
          scales: {
            x: {
              ticks: {
                color: '#64748b',
                maxTicksLimit: 10,
                callback: (_, i, arr) => {
                  if (i === 0 || i === arr.length - 1 || i % Math.floor(arr.length / 6) === 0)
                    return labels[i];
                  return '';
                }
              },
              grid: { color: 'rgba(100,116,139,0.15)' },
              title: { display: true, text: 't', color: '#94a3b8' }
            },
            y: {
              ticks: { color: '#64748b' },
              grid: { color: 'rgba(100,116,139,0.15)' },
              title: { display: true, text: 'y(t)', color: '#94a3b8' }
            }
          }
        }
      });
    } catch (e) {
      setError('Error al graficar: ' + e.message);
    }
  }

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6">
      <h2 className="text-xl font-semibold text-white mb-4">Gráfica de y(t)</h2>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <span>t mín:</span>
          <input
            type="number"
            value={tMin}
            onChange={e => setTMin(e.target.value)}
            step="0.5"
            className="w-20 bg-slate-900 border border-slate-600 text-white rounded px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <span>t máx:</span>
          <input
            type="number"
            value={tMax}
            onChange={e => setTMax(e.target.value)}
            step="0.5"
            className="w-20 bg-slate-900 border border-slate-600 text-white rounded px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <span>Puntos:</span>
          <input
            type="number"
            value={points}
            onChange={e => setPoints(e.target.value)}
            min="50" max="1000" step="50"
            className="w-20 bg-slate-900 border border-slate-600 text-white rounded px-2 py-1 text-sm"
          />
        </label>
        <button
          onClick={renderChart}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors cursor-pointer"
        >
          Actualizar
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-3">{error}</p>
      )}

      <div className="relative h-72 bg-slate-900/50 rounded-xl overflow-hidden">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
