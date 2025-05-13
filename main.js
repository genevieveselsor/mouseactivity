import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

async function loadData() {
    const rep = await fetch('data.json');
    const data = await rep.json();
    return data
}
const data = await loadData();
console.log(data);

const width = 1000;
const height = 300;
const margin = { top: 20, right: 20, bottom: 30, left: 40 };
let x0, x1;
let newDomain;

let currentData = data.slice();
let currentCategories = ['mavg','favg'];
let currentLightStateParam = null;
let showSex = [true, true];
let showLight = [true, true]; 


const xScale = d3.scaleLinear()
.domain([0, data[data.length - 1].hours])
.range([margin.left, width - margin.right]);
const initialXDomain = xScale.domain(); // for dblclick reset

function updateStats(subset, categories) {
    // male
    if (categories.includes('mavg') && subset.length) {
      d3.select('#avg-male')
        .text(d3.mean(subset, d => d.mavg).toFixed(2));
    } else {
      d3.select('#avg-male').text('N/A');
    }
    // female
    if (categories.includes('favg') && subset.length) {
      d3.select('#avg-female')
        .text(d3.mean(subset, d => d.favg).toFixed(2));
    } else {
      d3.select('#avg-female').text('N/A');
    }
  }

function renderPlot(data, categories, colors, lightState = null) {
  const svg = d3.select('#act-plot')
  
  svg.selectAll('*').remove();
  d3.selectAll('.tooltip').remove();
 
  svg.attr('width', width);
  svg.attr('height', height);

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
      .defined(d => lightState === null || d.lights === lightState)
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
 
 
  [x0, x1] = event.selection;
  newDomain = [xScale.invert(x0), xScale.invert(x1)];
 
 
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

 const brushedDiffData = data.filter(d =>
  d.hours >= newDomain[0] && d.hours <= newDomain[1]
 ).map(d => ({
  hours: d.hours,
  diff: d.mavg - d.favg,
  lights: d.lights
}));
 renderDifferencePlot(brushedDiffData, lightState);

  currentData = data.filter(d =>
    d.hours >= newDomain[0] &&
    d.hours <= newDomain[1] &&
    (currentLightState === null || d.lights === currentLightState)
    );
  updateStats(currentData, currentCategories);
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

  renderDifferencePlot(differenceData, lightState);
  
  currentData = data.filter(d =>
  currentLightState === null || d.lights === currentLightState
  );
  updateStats(currentData, currentCategories);
 });

 renderDifferencePlot(differenceData);
}

const differenceData = data.map(d => ({
  hours: d.hours,
  diff: d.mavg - d.favg,
  lights: d.lights
 })); 
renderPlot(data, ['mavg', 'favg'], ['royalblue', 'pink']);
renderDifferencePlot(differenceData);
updateStats(currentData, currentCategories);


function renderLegend(legend, items, colors, onClick) {
  legend.selectAll('*').remove();    // wipe old legends
  items.forEach((item, idx) => {
    legend.append('circle')
      .attr('cx', 100)
      .attr('cy', 75 + idx * 20)
      .attr('r', 7)
      .style('fill', colors[idx])
      .on('click', function() {
        onClick(idx)
      })
      .on('mouseover', function() {
        d3.select(this)
          .attr('stroke', '#333')
          .attr('stroke-width', 2);
      })
      .on('mouseout', function() {
        d3.select(this)
          .attr('stroke', 'none');
      });

    legend.append('text')
      .attr('x', 110)
      .attr('y', 75 + idx * 20)
      .text('toggle ' + item + ' line')
      .style('font-size', '15px')
      .attr('alignment-baseline', 'middle');
  });
}

function handleSexClick(idx) {
  // flip this series on/off
  showSex[idx] = !showSex[idx];

  // style the legend
  d3.select('#sexes').selectAll('text')
    .attr('class', (_, i) => showSex[i] ? null : 'hidden');

  // figure out which categories & colors remain
  currentCategories = ['mavg','favg'].filter((_,i) => showSex[i]);
  const cols = ['royalblue','pink'].filter((_,i) => showSex[i]);

  // re-render both plots with both filters
  d3.select('#act-plot').selectAll('*').remove();
  renderPlot(data, currentCategories, cols, currentLightStateParam);

  d3.select('#diff-chart').selectAll('*').remove();
  renderDifferencePlot(differenceData, currentLightStateParam);

  // update stats using only the light filter (stats only care about rows)
  if (currentLightStateParam === null) {
    currentData = data.slice();
  } else if (currentLightStateParam === '__none__') {
    currentData = [];
  } else {
    currentData = data.filter(d => d.lights === currentLightStateParam);
  }
  updateStats(currentData, currentCategories);
}

function handleLightClick(idx) {
  // flip this state on/off
  showLight[idx] = !showLight[idx];

  // style the legend
  d3.select('#lights').selectAll('text')
    .attr('class', (_, i) => showLight[i] ? null : 'hidden');

  // build allowed array
  const lightStates = ['On','Off'];
  const allowed = lightStates.filter((_, i) => showLight[i]);

  // derive your single render filter
  if (allowed.length === 2)         currentLightStateParam = null;
  else if (allowed.length === 1)    currentLightStateParam = allowed[0];
  else                               currentLightStateParam = '__none__';

  // re-render both plots with both filters
  d3.select('#act-plot').selectAll('*').remove();
  renderPlot(data, currentCategories, ['royalblue','pink'].filter((_,i)=>showSex[i]), currentLightStateParam);

  d3.select('#diff-chart').selectAll('*').remove();
  renderDifferencePlot(differenceData, currentLightStateParam);

  // update stats using both filters (stats only care about rows vs. categories)
  if (currentLightStateParam === null) {
    currentData = data.slice();
  } else if (currentLightStateParam === '__none__') {
    currentData = [];
  } else {
    currentData = data.filter(d => d.lights === currentLightStateParam);
  }
  updateStats(currentData, currentCategories);
}

const legends = d3.select('#legends');

renderLegend(
  d3.select('#lights'),
  ['On','Off'],
  ['orange','blue'],
  handleLightClick
);

renderLegend(
  legends.select('#sexes'),
  ['male','female'],
  ['royalblue','pink'],
  handleSexClick
);

function renderDifferencePlot(fullData, lightState = null) {
  const svg = d3.select('#diff-chart')
    .attr('width', width)
    .attr('height', 200);
 
  svg.selectAll('*').remove(); // clear old chart
 
  const innerHeight = 200 - margin.top - margin.bottom;
 
  // const x = d3.scaleLinear()
  //   .domain(d3.extent(fullData, d => d.hours))
  //   .range([margin.left, width - margin.right]);
 
  const y = d3.scaleLinear()
    .domain(d3.extent(fullData, d => d.diff))
    .range([innerHeight + margin.top, margin.top]);
 
  const xAxis = d3.axisBottom(xScale).ticks(6);
  const yAxis = d3.axisLeft(y);
 
  svg.append('g')
    .attr('transform', `translate(0, ${y(0)})`)
    .call(xAxis);
 
  svg.append('g')
    .attr('transform', `translate(${margin.left}, 0)`)
    .call(yAxis);
 
  const line = d3.line()
    .defined(d => lightState == null || d.lights === lightState)
    .x(d => xScale(d.hours))
    .y(d => y(d.diff));
 
  svg.append('path')
    .datum(fullData)
    .attr('fill', 'none')
    .attr('stroke', 'red')
    .attr('stroke-width', 1.5)
    .attr('d', line);

  const tooltip = d3.select('body')
  .append('div')
  .attr('class', 'tooltip')
  .style('position', 'absolute')
  .style('visibility', 'hidden')
  .style('background-color', 'white')
  .style('border', '1px solid #ddd')
  .style('padding', '5px')
  .style('border-radius', '3px')
  .style('font-size', '12px');

  const verticalLine = svg.append('line')
  .attr('class', 'hover-line')
  .attr('y1', margin.top)
  .attr('y2', innerHeight + margin.top)
  .style('stroke', '#999')
  .style('stroke-width', 1)
  .style('visibility', 'hidden');

  svg.append('rect')
  .attr('class', 'overlay')
  .attr('x', margin.left)
  .attr('y', margin.top)
  .attr('width', innerWidth)
  .attr('height', innerHeight)
  .style('fill', 'none')
  .style('pointer-events', 'all')
  .on('mouseover', () => {
    verticalLine.style('visibility', 'visible');
    tooltip.style('visibility', 'visible');
  })
  .on('mouseout', () => {
    verticalLine.style('visibility', 'hidden');
    tooltip.style('visibility', 'hidden');
  })
  .on('mousemove', function(event) {
    const [mouseX] = d3.pointer(event, this);
    const hoveredHour = xScale.invert(mouseX);

    const bisect = d3.bisector(d => d.hours).center;
    const i = bisect(fullData, hoveredHour);
    const d0 = fullData[i - 1], d1 = fullData[i];
    const d = d0 && d1
      ? (hoveredHour - d0.hours > d1.hours - hoveredHour ? d1 : d0)
      : (d0 || d1);
    if (!d) return;

    const xVal = xScale(d.hours);
    verticalLine.attr('x1', xVal).attr('x2', xVal);

    tooltip
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 28) + 'px')
      .html(`
        <strong>Hour:</strong> ${d.hours.toFixed(2)}<br>
        <strong>Difference:</strong> ${d.diff.toFixed(2)}
      `);
  });
}