import { useEffect, useRef } from 'react';
import katex from 'katex';
import { jsPDF } from 'jspdf';
import StepsViewer from './StepsViewer';
import GraphViewer from './GraphViewer';

function MathDisplay({ latex }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && latex) {
      try {
        katex.render(latex, ref.current, {
          displayMode: true,
          throwOnError: false,
          strict: false,
        });
      } catch {
        ref.current.textContent = latex;
      }
    }
  }, [latex]);
  return <span ref={ref} />;
}

function SolutionBox({ latex }) {
  return (
    <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/30 border border-indigo-500/50 rounded-xl p-5 overflow-x-auto">
      <MathDisplay latex={latex} />
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="bg-slate-800/80 border border-slate-700 rounded-lg px-4 py-3">
      <p className="text-slate-400 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-white font-medium mt-0.5">{value}</p>
    </div>
  );
}

export default function ResultsPanel({ result, equation, y0, dy0 }) {
  if (!result) return null;

  const { steps, solution, parsed } = result;

  function exportPDF() {
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      let y = 40;

      doc.setFontSize(18);
      doc.setTextColor(80, 80, 200);
      doc.text('Solución por Transformada de Laplace', W / 2, y, { align: 'center' });
      y += 30;

      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      doc.text(`Ecuación: ${equation}`, 40, y);
      y += 18;
      doc.text(`Condiciones iniciales: y(0) = ${y0}${parsed.order === 2 ? `, y'(0) = ${dy0}` : ''}`, 40, y);
      y += 30;

      doc.setFontSize(13);
      doc.setTextColor(40, 40, 40);
      doc.text('Pasos de resolución:', 40, y);
      y += 16;

      doc.setFontSize(10);
      steps.forEach((step, i) => {
        if (y > 750) { doc.addPage(); y = 40; }
        doc.setTextColor(80, 80, 200);
        doc.text(`Paso ${i + 1}: ${step.title}`, 40, y);
        y += 14;
        doc.setTextColor(60, 60, 60);
        if (step.description) {
          const descLines = doc.splitTextToSize(step.description.replace(/\\[()]/g, ''), W - 80);
          doc.text(descLines, 50, y);
          y += descLines.length * 12 + 4;
        }
        const mathLines = doc.splitTextToSize(step.latex, W - 80);
        doc.setFont('Courier', 'normal');
        doc.text(mathLines, 50, y);
        doc.setFont('Helvetica', 'normal');
        y += mathLines.length * 12 + 10;
      });

      if (y > 700) { doc.addPage(); y = 40; }
      doc.setFontSize(14);
      doc.setTextColor(80, 80, 200);
      doc.text('Solución Final:', 40, y);
      y += 18;
      doc.setFontSize(12);
      doc.setTextColor(20, 20, 20);
      doc.text(solution.latex, 40, y);

      doc.save('solucion-laplace.pdf');
    } catch (e) {
      alert('Error al exportar PDF: ' + e.message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Resultados</h2>
        <button
          onClick={exportPDF}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-200 text-sm rounded-xl transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar PDF
        </button>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <InfoCard label="Orden" value={`${parsed.order}° orden`} />
        <InfoCard label="y(0)" value={String(y0)} />
        {parsed.order === 2 && <InfoCard label="y'(0)" value={String(dy0)} />}
      </div>

      {/* Final solution */}
      <div>
        <h3 className="text-lg font-semibold text-indigo-300 mb-2">Solución Final</h3>
        <SolutionBox latex={solution.latex} />
      </div>

      {/* Graph */}
      <GraphViewer evaluate={solution.evaluate} solutionLatex={solution.latex} />

      {/* Steps */}
      <div>
        <h3 className="text-lg font-semibold text-slate-200 mb-3">Desarrollo Paso a Paso</h3>
        <StepsViewer steps={steps} />
      </div>
    </div>
  );
}
