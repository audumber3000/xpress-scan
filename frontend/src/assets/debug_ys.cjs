const fs = require('fs');

const svgPath = '/Users/audii3000/Documents/Personal Projects/xpress-scan/frontend/src/assets/dental_chart.svg';
const content = fs.readFileSync(svgPath, 'utf8');

const pathRegex = /transform="translate\(([^,)]+),([^,)]+)\)"/g;
let match;
const ys = new Set();
while ((match = pathRegex.exec(content)) !== null) {
    ys.add(parseFloat(match[2]));
}

console.log('Unique Y values found:', [...ys].sort((a, b) => a - b));
