import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

async function loadData() {
    const rep = await fetch('data.json');
    const data = await rep.json();
    return data
}

const data = await loadData();
console.log(data);

const svg = d3.select('#act-plot');

// copied this from lecture
const width = 1000;
const height = 300;
const margin = { top: 20, right: 20, bottom: 30, left: 40 };

svg.attr('width', width);
svg.attr('height', height);

// create scales
const xScale = d3
  .scaleLinear()
  .domain([0, data[data.length - 1].hours])
  .range([margin.left, width - margin.right]);

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

// add data to plot
const mLine = d3.line()
  .x(d => xScale(d.hours))
  .y(d => yScale(d.mavg));

svg
  .append('path')
  .datum(data)
  .attr('class', 'favg')
  .attr('fill', 'none')
  .attr('stroke', 'royalblue')
  .attr('stroke-width', 1.5)
  .attr('d', mLine);

const fLine = d3.line()
  .x(d => xScale(d.hours))
  .y(d => yScale(d.favg));

svg
  .append('path')
  .datum(data)
  .attr('class', 'favg')
  .attr('fill', 'none')
  .attr('stroke', 'pink')
  .attr('stroke-width', 1.5)
  .attr('d', fLine);