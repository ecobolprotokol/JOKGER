import { useRef, useEffect } from 'react';

type ChartKind = 'bar' | 'line';

interface Series {
  label: string;
  data: number[];
  color?: string;
}

export function Chart({
  kind,
  series,
  labels,
  formatValue,
}: {
  kind: ChartKind;
  series: Series[];
  labels: string[];
  formatValue: (value: number) => string;
}): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;

    const width = container.clientWidth;
    const height = 300;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const allValues = series.flatMap((s) => s.data);
    const maxValue = Math.max(...allValues, 0);
    const minValue = Math.min(...allValues, 0);

    const xStep = chartWidth / Math.max(labels.length - 1, 1);
    const yScale = chartHeight / (maxValue - minValue || 1);

    const colors = series.map((_, i) => `hsl(${i * 60}, 70%, 50%)`);

    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${padding.left}, ${padding.top})`);
    svg.appendChild(g);

    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    yAxis.setAttribute('class', 'chart-axis');
    for (let i = 0; i <= 5; i++) {
      const value = maxValue - (i / 5) * (maxValue - minValue);
      const y = i * (chartHeight / 5);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', String(y));
      line.setAttribute('x2', String(chartWidth));
      line.setAttribute('y2', String(y));
      line.setAttribute('stroke', 'var(--border)');
      line.setAttribute('stroke-width', '1');
      yAxis.appendChild(line);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', '-8');
      text.setAttribute('y', String(y + 4));
      text.setAttribute('text-anchor', 'end');
      text.setAttribute('font-size', '11');
      text.setAttribute('fill', 'var(--text-muted)');
      text.textContent = formatValue(value);
      yAxis.appendChild(text);
    }
    g.appendChild(yAxis);

    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    xAxis.setAttribute('class', 'chart-axis');
    labels.forEach((label, i) => {
      const x = i * xStep;
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(x));
      text.setAttribute('y', String(chartHeight + 20));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '11');
      text.setAttribute('fill', 'var(--text-muted)');
      text.textContent = label;
      xAxis.appendChild(text);
    });
    g.appendChild(xAxis);

    series.forEach((s, si) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const color = s.color || colors[si] || 'var(--brand)';
      let d = '';

      s.data.forEach((value, i) => {
        const x = i * xStep;
        const y = chartHeight - (value - minValue) * yScale;
        if (i === 0) {
          d += `M ${x} ${y}`;
        } else {
          if (kind === 'line') {
            d += ` L ${x} ${y}`;
          } else {
            const barWidth = Math.max((xStep * 0.6) / series.length, 4);
            const barX = x - (barWidth * series.length) / 2 + si * barWidth + barWidth / 2;
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', String(barX));
            rect.setAttribute('y', String(y));
            rect.setAttribute('width', String(barWidth));
            rect.setAttribute('height', String(chartHeight - y));
            rect.setAttribute('fill', color);
            rect.setAttribute('rx', '2');
            g.appendChild(rect);
          }
        }
      });

      if (kind === 'line') {
        path.setAttribute('d', d);
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        g.appendChild(path);
      }
    });

    const legend = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    legend.setAttribute('class', 'chart-legend');
    legend.setAttribute('transform', `translate(${padding.left}, ${padding.top - 18})`);
    series.forEach((s, i) => {
      const gLegend = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gLegend.setAttribute('transform', `translate(${i * 120}, 0)`);
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', '6');
      dot.setAttribute('cy', '6');
      dot.setAttribute('r', '5');
      dot.setAttribute('fill', s.color || colors[i] || 'var(--brand)');
      gLegend.appendChild(dot);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', '16');
      text.setAttribute('y', '10');
      text.setAttribute('font-size', '12');
      text.setAttribute('fill', 'var(--text)');
      text.textContent = s.label;
      gLegend.appendChild(text);
      legend.appendChild(gLegend);
    });
    svg.appendChild(legend);
  }, [kind, series, labels, formatValue]);

  return (
    <div className="chart-container" ref={containerRef}>
      <svg ref={svgRef} className="chart-svg" role="img" aria-label="Grafik data" />
      <table className="chart-table visually-hidden">
        <thead>
          <tr>
            <th>Periode</th>
            {series.map((s) => (
              <th key={s.label}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={label}>
              <td>{label}</td>
              {series.map((s) => (
                <td key={s.label}>{s.data[i] === undefined ? '—' : formatValue(s.data[i] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
