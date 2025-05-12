import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

async function loadData() {
    const rep = await fetch('data.json');
    const data = await rep.json();
    return data
}

function renderPlot(data, categories, colors) {
  const width = 1000;
  const height = 300;
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };

  const svg = d3.select('#act-plot')
    .attr('width', width)
    .attr('height', height);

  const xScale = d3.scaleLinear()
    .domain([0, data[data.length - 1].hours])
    .range([margin.left, width - margin.right]);
  const initialXDomain = xScale.domain(); // for dblclick reset

  const yMin = d3.min(data, d => d3.min(categories, c => d[c]));
  const yMax = d3.max(data, d => d3.max(categories, c => d[c]));
  const yScale = d3.scaleLinear()
    .domain([yMin, yMax])
    .range([height - margin.bottom, margin.top]);

  const xAxis = d3.axisBottom(xScale).ticks(6);
  const yAxis = d3.axisLeft(yScale);

  svg.append('g')
    .attr('class', 'x axis')
    .attr('transform', `translate(0, ${height - margin.bottom})`)
    .call(xAxis);

  svg.append('g')
    .attr('class', 'y axis')
    .attr('transform', `translate(${margin.left}, 0)`)
    .call(yAxis);

  // clip‐path so lines don't spill
  svg.append('defs')
    .append('clipPath')
      .attr('id', 'clip')
    .append('rect')
      .attr('x', margin.left)
      .attr('y', margin.top)
      .attr('width', width - margin.left - margin.right)
      .attr('height', height - margin.top - margin.bottom);

  const chartArea = svg.append('g')
    .attr('class', 'chart-area')
    .attr('clip-path', 'url(#clip)');

  // build one line generator per category, store for reuse in brush/dblclick
  const lineGenerators = {};
  
  categories.forEach((cat, idx) => {
    lineGenerators[cat] = d3.line()
      .x(d => xScale(d.hours))
      .y(d => yScale(d[cat]));

    chartArea.append('path')
      .datum(data)
      .attr('class', cat)
      .attr('fill', 'none')
      .attr('stroke', colors[idx])
      .attr('stroke-width', 1.5)
      .attr('d', lineGenerators[cat]);
  });

  // brush
  const brush = d3.brushX()
    .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
    .on('end', brushed);

  svg.append('g')
    .attr('class', 'brush')
    .call(brush);

  function brushed(event) {
    if (!event.selection || event.selection[0] === event.selection[1]) return;

    const [x0, x1] = event.selection;
    xScale.domain([ xScale.invert(x0), xScale.invert(x1) ]);

    // update X axis
    svg.select('.x.axis')
      .transition().duration(750)
      .call(d3.axisBottom(xScale));

    // update each line
    categories.forEach(cat => {
      chartArea.select(`.${cat}`)
        .transition().duration(750)
        .attr('d', lineGenerators[cat]);
    });

    // clear brush
    svg.select('.brush').call(brush.move, null);
  }

  // double‑click to reset
  svg.on('dblclick', () => {
    xScale.domain(initialXDomain);

    svg.select('.x.axis')
      .transition().duration(750)
      .call(d3.axisBottom(xScale));

    categories.forEach(cat => {
      chartArea.select(`.${cat}`)
        .transition().duration(750)
        .attr('d', lineGenerators[cat]);
    });
  });
}

const data = await loadData();
console.log(data);
renderPlot(data, ['mavg', 'favg'], ['royalblue', 'pink']);

const legends = d3.select('#legends');