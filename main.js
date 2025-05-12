import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';


async function loadData() {
    const rep = await fetch("data.json");
    const data = await rep.json();
    return data
}

const data = await loadData();
console.log(data);

const svg = d3.select("#act-plot");

// copied this from lecture
const width = 1000;
const height = 300;
const margin = { top: 20, right: 20, bottom: 30, left: 40 };

svg.attr('width', width);
svg.attr('height', height);

// create scales
const XScale = d3
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