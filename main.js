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

  // tooltip
  const tooltip = d3
  .select('body')
  .append('div')
  .attr('class', 'tooltip')
  .style('position', 'absolute')
  .style('visibility', 'hidden')
  .style('background-color', 'white')
  .style('border', '1px solid #ddd')
  .style('padding', '5px')
  .style('border-radius', '3px')
  .style('font-size', '12px');
 
 
  const verticalLine = svg
  .append('line')
  .attr('class', 'hover-line')
  .attr('y1', margin.top)
  .attr('y2', height - margin.bottom)
  .style('stroke', '#999')
  .style('stroke-width', 1)
  .style('visibility', 'hidden');
 
 
 // Brush functionality
  const brush = d3.brushX()
  .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
  .on('end', brushed);
 
 
  const brushG = svg
  .append('g')
  .attr('class', 'brush')
  .call(brush)
 
 
  const brushOverlay = brushG.select('.overlay');
  // now wire up tooltip + vertical line onto THAT same overlay:
  brushOverlay
  .on('mouseover', () => {
    verticalLine.style('visibility', 'visible');
    tooltip.style('visibility', 'visible');
  })
  .on('mouseout', () => {
    verticalLine.style('visibility', 'hidden');
    tooltip.style('visibility', 'hidden');
  })
  .on('mousemove', function(event) {
    // compute mouseX relative to the SVG
    const [mouseX] = d3.pointer(event, svg.node());
    const hoveredHour = xScale.invert(mouseX);
 
 
    // find the nearest data point
    const bisect = d3.bisector(d => d.hours).center;
    const i = bisect(data, hoveredHour);
    const d0 = data[i - 1], d1 = data[i];
    const d = d0 && d1
      ? (hoveredHour - d0.hours > d1.hours - hoveredHour ? d1 : d0)
      : (d0 || d1);
    if (!d) return;
 
 
    // move the vertical line
    const x = xScale(d.hours);
    verticalLine.attr('x1', x).attr('x2', x)
                .style('visibility', 'visible');
 
 
    // position & populate the tooltip
    tooltip
      .style('left',  (event.pageX + 10) + 'px')
      .style('top',   (event.pageY - 28) + 'px')
      .html(`
        <strong>Hour:</strong> ${d.hours.toFixed(2)}<br>
        <span style="color:royalblue">
          <strong>Male:</strong> ${d.mavg.toFixed(2)}
        </span><br>
        <span style="color:pink">
          <strong>Female:</strong> ${d.favg.toFixed(2)}
        </span>
      `);
  });
 
 
  // Brushing function
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
    .attr('d', lineGenerators.mavg);
 
 
  chartArea.select('.favg')
    .transition()
    .duration(750)
    .attr('d', lineGenerators.favg);
 
 
  // Clear brush selection
  svg.select('.brush').call(brush.move, null);
 }
 
 
 // Reset functionality on double-click
 svg.on('dblclick', () => {
  xScale.domain(initialXDomain); // reset domain
 
 
  // Update axes
  svg.select('.x.axis')
    .transition()
    .duration(750)
    .call(d3.axisBottom(xScale));
 
 
  // Redraw lines within the chartArea (clipped group)
  chartArea.select('.mavg')
    .transition()
    .duration(750)
    .attr('d', lineGenerators.mavg);
 
 
  chartArea.select('.favg')
    .transition()
    .duration(750)
    .attr('d', lineGenerators.favg);
 });
 
}

const data = await loadData();
console.log(data);
renderPlot(data, ['mavg', 'favg'], ['royalblue', 'pink']);

const legends = d3.select('#legends');