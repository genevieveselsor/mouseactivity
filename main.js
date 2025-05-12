import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

async function loadData() {
    const rep = await fetch('data.json');
    const data = await rep.json();
    return data
}

function renderPlot(data) {
  // copied this from lecture
  const width = 1000;
  const height = 300;
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };

  const svg = d3.select('#act-plot');
  svg.attr('width', width);
  svg.attr('height', height);

  // create scales
  const xScale = d3
    .scaleLinear()
    .domain([0, data[data.length - 1].hours])
    .range([margin.left, width - margin.right]);
  const initialXDomain = xScale.domain(); // save initial domain (for brushing)

  const minF = d3.min(data, d => d.favg);
  const minM = d3.min(data, d => d.mavg);
  const maxF = d3.max(data, d => d.favg);
  const maxM = d3.max(data, d => d.mavg);

  const yScale = d3
    .scaleLinear()
    .domain([
      Math.min(minF, minM),
      Math.max(maxF, maxM)
    ])
    .range([height - margin.bottom, margin.top]);

  // create axes
  const xAxis = d3
    .axisBottom(xScale)
    .ticks(28)

  const yAxis = d3.axisLeft(yScale);

  // add gridlines to svg plot
  svg
    .append('g')
    .attr('class', 'x axis')
    .attr('transform', `translate(0, ${height - margin.bottom})`)
    .call(xAxis);

  svg
    .append('g')
    .attr('class', 'y axis')
    .attr('transform', `translate(${margin.left}, 0)`)
    .call(yAxis);

  // enfore chart area so lines don't spill past axes
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

    // add data to plot
  const mLine = d3.line()
    .x(d => xScale(d.hours))
    .y(d => yScale(d.mavg));

  chartArea
    .append('path')
    .datum(data)
    .attr('class', 'mavg')
    .attr('fill', 'none')
    .attr('stroke', 'royalblue')
    .attr('stroke-width', 1.5)
    .attr('d', mLine);

  const fLine = d3.line()
    .x(d => xScale(d.hours))
    .y(d => yScale(d.favg));

  chartArea
    .append('path')
    .datum(data)
    .attr('class', 'favg')
    .attr('fill', 'none')
    .attr('stroke', 'pink')
    .attr('stroke-width', 1.5)
    .attr('d', fLine);

  const brush = d3.brushX()
    .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
    .on('end', brushed);
  
  // append brush to svg
  svg.append('g')
    .attr('class', 'brush')
    .call(brush);

  function brushed(event) {
    if (!event.selection || event.selection[0] === event.selection[1]) return;

    const [x0, x1] = event.selection;
    const newDomain = [xScale.invert(x0), xScale.invert(x1)];
  
    // Update xScale
    xScale.domain(newDomain);
  
    // Transition axes
    svg.select('.x.axis')
      .transition()
      .duration(750)
      .call(d3.axisBottom(xScale));
  
    // Transition lines
    chartArea.select('.mavg')
      .transition()
      .duration(750)
      .attr('d', mLine);
  
    chartArea.select('.favg')
      .transition()
      .duration(750)
      .attr('d', fLine);
  
    // Clear brush selection
    svg.select('.brush').call(brush.move, null);
  }

  svg.on('dblclick', () => {
    xScale.domain(initialXDomain); // reset domain
  
    // Update axes
    svg.select('.x.axis')
      .transition()
      .duration(750)
      .call(d3.axisBottom(xScale));
  
    // Redraw lines within the chartArea
    chartArea.select('.mavg')
      .transition()
      .duration(750)
      .attr('d', mLine);
  
    chartArea.select('.favg')
      .transition()
      .duration(750)
      .attr('d', fLine);
  });
}

const data = await loadData();
console.log(data);
renderPlot(data);

const legends = d3.select('#legends');
const sexLegend = legends.select('#sexes');
const sexes = ['male', 'female'];
const sexColors = ['royalblue', 'pink'];
sexes.forEach((sex, idx) => {
  sexLegend
    .append('circle')
    .attr('cx', 100)
    .attr('cy', 75 + idx * 20)
    .attr('r', 5)
    .style('fill', sexColors[idx])
  
  sexLegend
    .append('text')
    .attr('x', 110)
    .attr('y', 75 + idx * 20)
    .text(sex)
    .style("font-size", "15px")
    .attr("alignment-baseline","middle")
});
const lightLegend = legends.select('#lights');
const lights = ['on', 'off'];
const lightColors = ['yellow', 'blue'];
lights.forEach((sex, idx) => {
  lightLegend
    .append('circle')
    .attr('cx', 100)
    .attr('cy', 75 + idx * 20)
    .attr('r', 5)
    .style('fill', lightColors[idx])
  
  lightLegend
    .append('text')
    .attr('x', 110)
    .attr('y', 75 + idx * 20)
    .text(sex)
    .style("font-size", "15px")
    .attr("alignment-baseline","middle")
});