import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// load mouse data
async function loadData() {
  const rep = await fetch('data.json');
  const data = await rep.json();
  return data;
}

const data = await loadData();

// set global dimensions
const width  = 1000;
const height = 300;
const margin = { top: 40, right: 20, bottom: 30, left: 60 };

let currentData = data.slice();
let currentCategories = ['mavg', 'favg'];
let currentLightStateParam = null;
let showSex = [true, true];
let showLight = [true, true];

let x0, x1;
let newDomain;

const xScale = d3
  .scaleLinear()
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

  // difference *only* if both are on
  if (categories.includes('mavg') && categories.includes('favg') && subset.length) {
    const diffAvg = d3.mean(subset, d => d.mavg - d.favg).toFixed(2);
    d3.select('#avg-diff').text(diffAvg);
    d3.select('#diff-chart').style('display', null);
  } else {
    d3.select('#avg-diff').text('N/A');
    d3.select('#diff-chart').style('display', 'none');
  }
}

function renderPlot(plotData, categories, colors, lightState = null) {
  const svg = d3.select('#act-plot')
    .attr('width',  width)
    .attr('height', height);

  svg.selectAll('*').remove();
  d3.selectAll('.tooltip').remove();

  // title
  svg.append('text')
    .attr('class', 'chart-title')
    .attr('x', width / 2)
    .attr('y', margin.top / 1.5)
    .attr('text-anchor', 'middle')
    .style('font-size', '16px')
    .text('Mice Activity Over Time');

  // scales
  const yMin = d3.min(data, d => d3.min(categories, c => d[c]));
  const yMax = d3.max(data, d => d3.max(categories, c => d[c]));
  const yScale = d3
    .scaleLinear()
    .domain([yMin, yMax])
    .range([height - margin.bottom, margin.top]);

  const xAxis = d3.axisBottom(xScale).ticks(6);
  const yAxis = d3.axisLeft(yScale);

  // axis labels
  svg.append('text')
    .attr('class', 'x axis-label')
    .attr('x', width / 2)
    .attr('y', height - margin.bottom / 5)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .text('Hours');

  svg.append('text')
    .attr('class', 'y axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -(height / 2))
    .attr('y', margin.left / 2)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .text('Average Activity');

  // axes
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
      .attr('width',  width - margin.left - margin.right)
      .attr('height', height - margin.top - margin.bottom);

  const chartArea = svg.append('g')
    .attr('class', 'chart-area')
    .attr('clip-path', 'url(#clip)');

  // build one line generator per category
  const lineGenerators = {};
  categories.forEach((cat, idx) => {
    lineGenerators[cat] = d3.line()
      .defined(d => lightState === null || d.lights === lightState)
      .x(d => xScale(d.hours))
      .y(d => yScale(d[cat]));

    chartArea.append('path')
      .datum(plotData)
      .attr('class', cat)
      .attr('fill', 'none')
      .attr('stroke', colors[idx])
      .attr('stroke-width', 1.5)
      .attr('d', lineGenerators[cat]);
  });

  // tooltip & hover line
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
    .attr('y2', height - margin.bottom)
    .style('stroke', '#999')
    .style('stroke-width', 1)
    .style('visibility', 'hidden');

  // brush
  const brush = d3.brushX()
    .extent([
      [margin.left, margin.top],
      [width - margin.right, height - margin.bottom]
    ])
    .on('end', brushed);

  const brushG = svg.append('g')
    .attr('class', 'brush')
    .call(brush);

  const brushOverlay = brushG.select('.overlay');
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
      const [mouseX] = d3.pointer(event, svg.node());
      const hoveredHour = xScale.invert(mouseX);
      const [minH, maxH] = xScale.domain();
      const visible = plotData
        .filter(d => d.hours >= minH && d.hours <= maxH)
        .filter(d => lightState === null || d.lights === lightState);

      const bisect = d3.bisector(d => d.hours).center;
      const i = bisect(visible, hoveredHour);
      const d0 = visible[i - 1];
      const d1 = visible[i];
      const d = d0 && d1
        ? (hoveredHour - d0.hours > d1.hours - hoveredHour ? d1 : d0)
        : (d0 || d1);
      if (!d) return;

      const x = xScale(d.hours);
      verticalLine
        .attr('x1', x)
        .attr('x2', x)
        .style('visibility', 'visible');

      tooltip
        .style('left', (event.pageX + 10) + 'px')
        .style('top',  (event.pageY - 28) + 'px')
        .html(`
          <strong>Hour:</strong> ${d.hours.toFixed(2)}<br>
          ${categories.includes('mavg')
            ? `<span style="color:oklch(0.68 0.1603 227.65)">
                 <strong>Male:</strong> ${d.mavg.toFixed(2)}
               </span><br>`
            : ''
          }
          ${categories.includes('favg')
            ? `<span style="color:oklch(0.7 0.2195 0)">
                 <strong>Female:</strong> ${d.favg.toFixed(2)}
               </span>`
            : ''
          }
        `);
    });

  function brushed(event) {
    if (!event.selection || event.selection[0] === event.selection[1]) return;

    [x0, x1] = event.selection;
    newDomain = [xScale.invert(x0), xScale.invert(x1)];
    xScale.domain(newDomain);

    svg.select('.x.axis')
      .transition()
      .duration(750)
      .call(d3.axisBottom(xScale));

    chartArea.select('.mavg')
      .transition()
      .duration(750)
      .attr('d', lineGenerators.mavg);

    chartArea.select('.favg')
      .transition()
      .duration(750)
      .attr('d', lineGenerators.favg);

    svg.select('.brush').call(brush.move, null);

    const brushedDiffData = data
      .filter(d => d.hours >= newDomain[0] && d.hours <= newDomain[1])
      .map(d => ({
        hours: d.hours,
        diff: d.mavg - d.favg,
        lights: d.lights
      }));
    renderDifferencePlot(brushedDiffData, lightState);

    currentData = data.filter(d =>
      d.hours >= newDomain[0] &&
      d.hours <= newDomain[1] &&
      (lightState === null || d.lights === lightState)
    );
    updateStats(currentData, currentCategories);
  }

  svg.on('dblclick', () => {
    xScale.domain(initialXDomain);

    svg.select('.x.axis')
      .transition()
      .duration(750)
      .call(d3.axisBottom(xScale));

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
      lightState === null || d.lights === lightState
    );
    updateStats(currentData, currentCategories);
  });
}

const differenceData = data.map(d => ({
  hours: d.hours,
  diff: d.mavg - d.favg,
  lights: d.lights
}));
const yMax = d3.max(differenceData, d => d.diff);
const yMin = d3.min(differenceData, d => d.diff);

renderPlot(data, currentCategories, ['oklch(0.68 0.1603 227.65)', 'oklch(0.7 0.2195 0)']);
renderDifferencePlot(differenceData);
updateStats(currentData, currentCategories);

function renderLegend(legend, items, colors, onClick) {
  legend.selectAll('*').remove();

  items.forEach((item, idx) => {
    legend.append('circle')
      .attr('cx', 15)
      .attr('cy', 15 + idx * 25)
      .attr('r', 7)
      .style('fill', colors[idx])
      .on('click', onClick.bind(null, idx))
      .on('mouseover', function() {
        d3
          .select(this)
          .attr('stroke', '#333')
          .attr('stroke-width', 2);
      })
      .on('mouseout', function() {
        d3
          .select(this)
          .attr('stroke', 'none');
      });

    legend.append('text')
      .attr('x', 30)
      .attr('y', 15 + idx * 25)
      .text(`${item}`)
      .style('font-size', '15px')
      .attr('alignment-baseline', 'middle');
  });
}

function handleSexClick(idx) {
  showSex[idx] = !showSex[idx];

  d3.select('#sexes').selectAll('text')
    .attr('class', (_, i) => showSex[i] ? null : 'hidden');
  d3.select('#sexes').selectAll('circle')
    .attr('class', (_, i) => showSex[i] ? null : 'hidden');

  currentCategories = ['mavg', 'favg'].filter((_, i) => showSex[i]);
  const cols = ['oklch(0.68 0.1603 227.65)', 'oklch(0.7 0.2195 0)'].filter((_, i) => showSex[i]);

  d3.select('#act-plot').selectAll('*').remove();
  renderPlot(data, currentCategories, cols, currentLightStateParam);

  d3.select('#diff-chart').selectAll('*').remove();
  renderDifferencePlot(differenceData, currentLightStateParam);

  updateStats(currentData, currentCategories);
}

function handleLightClick(idx) {
  showLight[idx] = !showLight[idx];

  d3.select('#lights').selectAll('text')
    .attr('class', (_, i) => showLight[i] ? null : 'hidden');
  d3.select('#lights').selectAll('circle')
    .attr('class', (_, i) => showLight[i] ? null : 'hidden');

  const lightStates = ['On', 'Off'];
  const allowed = lightStates.filter((_, i) => showLight[i]);

  if (allowed.length === 2) {
    currentLightStateParam = null;
  } else if (allowed.length === 1){
    currentLightStateParam = allowed[0];
  } else {
    currentLightStateParam = '__none__';
  }

  const [minH, maxH] = xScale.domain();
  const brushSubset  = data.filter(d =>
    d.hours >= minH && d.hours <= maxH
  );

  if (currentLightStateParam === null) {
    currentData = brushSubset.slice();
  } else if (currentLightStateParam === '__none__') {
    currentData = [];
  } else {
    currentData = brushSubset.filter(d =>
      d.lights === currentLightStateParam
    );
  }

  const cols = ['oklch(0.68 0.1603 227.65)', 'oklch(0.7 0.2195 0)'].filter((_, i) => showSex[i]);

  d3.select('#act-plot').selectAll('*').remove();
  renderPlot(data, currentCategories, cols, currentLightStateParam);

  d3.select('#diff-chart').selectAll('*').remove();
  renderDifferencePlot(differenceData, currentLightStateParam);

  updateStats(currentData, currentCategories);
}

const legends = d3.select('#legends');

renderLegend(
  d3.select('#lights'),
  ['Turn Lights Off', 'Turn Lights On'],
  ['oklch(0.45 0.0419 244.59)', 'oklch(0.91 0.1727 97.41)'],
  handleLightClick
);

renderLegend(
  legends.select('#sexes'),
  ['Toggle Male Data', 'Toggle Female Data'],
  ['oklch(0.68 0.1603 227.65)', 'oklch(0.7 0.2195 0)'],
  handleSexClick
);

function renderDifferencePlot(fullData, lightState = null) {
  const svg = d3
    .select('#diff-chart')
    .attr('width',  width)
    .attr('height', 200);

  svg.selectAll('*').remove();

  // title
  svg.append('text')
    .attr('class', 'chart-title')
    .attr('x', width / 2)
    .attr('y', margin.top)
    .attr('text-anchor', 'middle')
    .style('font-size', '16px')
    .text('Difference Between Male and Female Activity');

  const innerWidth  = width  - margin.left - margin.right;
  const innerHeight = 200 - margin.top - margin.bottom;

  const y = d3
    .scaleLinear()
    .domain([yMin, yMax])
    .range([innerHeight + margin.top, margin.top]);

  const xAxis = d3.axisBottom(xScale).ticks(6);
  const yAxis = d3.axisLeft(y);

  svg.append('defs')
  .append('clipPath')
    .attr('id', 'clip-diff')
  .append('rect')
    .attr('x', margin.left)
    .attr('y', margin.top)
    .attr('width', innerWidth)
    .attr('height', innerHeight);
  
  // axis labels
  svg.append('text')
    .attr('class', 'x axis-label')
    .attr('x', width / 2)
    .attr('y', 200 - margin.bottom / 5)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .text('Hours');

    const zeroY = y(0);

    svg.append('text')
      .attr('class', 'y axis-label')
      .attr(
        'transform',
        'rotate(-90,' + (margin.left/2) + ',' + zeroY + ')'
      )
      .attr('x', margin.left/2)
      .attr('y', zeroY)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Difference');

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
    .attr('clip-path', 'url(#clip-diff)')
    .datum(fullData)
    .attr('fill', 'none')
    .attr('stroke', 'oklch(0.7 0.1677 50.82)')
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
      const [minH,maxH] = xScale.domain();
      const visible = fullData
        .filter(d => d.hours >= minH && d.hours <= maxH)
        .filter(d => lightState === null || d.lights === lightState);

      const bisect = d3.bisector(d => d.hours).center;
      const i = bisect(visible, hoveredHour);
      const d0 = visible[i - 1];
      const d1 = visible[i];
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

function resetAll() {
  xScale.domain(initialXDomain);
  d3
    .select('#act-plot .brush')
    .call(d3.brushX().move, null)
    .transition()
    .duration(750);

  showSex = [true, true];
  showLight = [true, true];
  currentCategories = ['mavg', 'favg'];
  currentLightStateParam = null;

  currentData = data.slice();

  d3.selectAll('#lights circle, #lights text, #sexes circle, #sexes text')
    .classed('hidden', false);

  d3.select('#act-plot').selectAll('*').remove();
  renderPlot(data, currentCategories, ['oklch(0.68 0.1603 227.65)', 'oklch(0.7 0.2195 0)'], null);

  d3.select('#diff-chart').selectAll('*').remove();
  renderDifferencePlot(differenceData, null);

  d3.select('#lights').style('border', 'none');

  updateStats(currentData, currentCategories);
}

const resetSvg = d3.select('#reset-legend')
  .attr('width',  120)
  .attr('height', 40)
  .style('cursor', 'pointer')
  .on('click', resetAll);

const resetG = resetSvg.append('g')
  .attr('class', 'reset-btn')
  .attr('transform', 'translate(10,5)')
  .style('cursor', 'pointer')
  .on('click', resetAll)
  .on('mouseover', function() {
    d3.select(this).select('rect').attr('fill', '#e0e0e0');
  })
  .on('mouseout', function() {
    d3.select(this).select('rect').attr('fill', '#f0f0f0');
  });

const btnW = 100;
const btnH = 30;

// 1) draw the button background
resetG.append('rect')
  .attr('width', btnW)
  .attr('height', btnH)
  .attr('rx', 5)
  .attr('ry', 5)
  .attr('fill', '#f0f0f0')
  .attr('stroke', '#333');

// 2) draw the text centered in that rect
resetG.append('text')
  .attr('x', btnW / 2)
  .attr('y', btnH / 2)
  .attr('dy', '0.35em')
  .attr('text-anchor','middle')
  .style('font-size','13px')
  .text('Reset All');
