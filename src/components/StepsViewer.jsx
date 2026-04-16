import { useEffect, useRef } from 'react';
import katex from 'katex';

function MathBlock({ latex, display = true }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      try {
        katex.render(latex, ref.current, {
          displayMode: display,
          throwOnError: false,
          trust: true,
          strict: false,
        });
      } catch (e) {
        ref.current.textContent = latex;
      }
    }
  }, [latex, display]);
  return <span ref={ref} />;
}

function MathInline({ latex }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      try {
        katex.render(latex, ref.current, {
          displayMode: false,
          throwOnError: false,
          strict: false,
        });
      } catch (e) {
        ref.current.textContent = latex;
      }
    }
  }, [latex]);
  return <span ref={ref} className="inline" />;
}

// Render description that may contain \(...\) inline math
function Description({ text }) {
  if (!text) return null;
  const parts = text.split(/(\\\(.*?\\\))/g);
  return (
    <p className="text-slate-400 text-sm mt-1">
      {parts.map((part, i) => {
        if (part.startsWith('\\(') && part.endsWith('\\)')) {
          const inner = part.slice(2, -2);
          return <MathInline key={i} latex={inner} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

export default function StepsViewer({ steps }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="space-y-3">
      {steps.map((step, idx) => (
        <div
          key={idx}
          className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4"
        >
          <div className="flex items-start gap-3 mb-3">
            <span className="flex-shrink-0 inline-flex items-center justify-center w-7 h-7 bg-indigo-600 text-white rounded-full text-xs font-bold">
              {idx + 1}
            </span>
            <div className="flex-1">
              <h3 className="text-indigo-300 font-semibold text-sm">{step.title}</h3>
              <Description text={step.description} />
            </div>
          </div>
          <div className="overflow-x-auto bg-slate-900/60 rounded-lg p-3">
            <MathBlock latex={step.latex} display={true} />
          </div>
        </div>
      ))}
    </div>
  );
}
