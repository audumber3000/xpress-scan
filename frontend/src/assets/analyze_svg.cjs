const fs = require('fs');

const svgPath = '/Users/audii3000/Documents/Personal Projects/xpress-scan/frontend/src/assets/dental_chart.svg';
const content = fs.readFileSync(svgPath, 'utf8');

const paths = [];
const pathBlocks = content.split('<path').slice(1);

for (const block of pathBlocks) {
    const dMatch = block.match(/d="([^"]+)"/);
    const fillMatch = block.match(/fill="([^"]+)"/);
    const transformMatch = block.match(/transform="translate\(([^,)]+),([^,)]+)\)"/);

    if (dMatch && fillMatch) {
        const fill = fillMatch[1].toUpperCase();
        // Skip background (it's white/off-white #FEFDFD)
        if (fill === '#FEFDFD') continue;

        paths.push({
            d: dMatch[1],
            fill: fillMatch[1],
            x: transformMatch ? parseFloat(transformMatch[1]) : 0,
            y: transformMatch ? parseFloat(transformMatch[2]) : 0
        });
    }
}

function groupTeeth(row, expectedCount) {
    row.sort((a, b) => a.x - b.x);
    if (row.length === 0) return [];

    // Brute force threshold to find exactly N teeth
    for (let threshold = 5; threshold < 50; threshold++) {
        const clusters = [];
        let currentCluster = [row[0]];

        for (let i = 1; i < row.length; i++) {
            if (row[i].x - row[i - 1].x < threshold) {
                currentCluster.push(row[i]);
            } else {
                clusters.push(currentCluster);
                currentCluster = [row[i]];
            }
        }
        clusters.push(currentCluster);

        if (clusters.length === expectedCount) {
            console.log(`Found exactly ${expectedCount} teeth with threshold ${threshold}`);
            return clusters;
        }
    }
    return null;
}

const upperPaths = paths.filter(p => p.y < 150);
const lowerPaths = paths.filter(p => p.y >= 150);

const upperTeeth = groupTeeth(upperPaths, 16);
const lowerTeeth = groupTeeth(lowerPaths, 16);

if (!upperTeeth || !lowerTeeth) {
    console.log('Failed to find 16 teeth in one of the rows.');
    console.log('Upper found:', upperTeeth ? '16' : 'not 16');
    console.log('Lower found:', lowerTeeth ? '16' : 'not 16');
} else {
    const mapping = {};
    // Universal numbering: 1 (UR) to 16 (UL), 17 (LL) to 32 (LR)
    // The SVG X-axis goes from 0 to 1169.
    // Upper row (L to R in image): usually 1 is Upper Right (left side of image if looking at patient).
    // Let's assume left-to-right increment 1-16.
    upperTeeth.forEach((tooth, i) => {
        mapping[i + 1] = tooth;
    });
    // Lower row (L to R in image): Usually 17 is Lower Left (right side of image).
    // Let's assume left-to-right decrement 32-17 or increment 32-17? 
    // Standard: UR(1) -> UL(16), LL(17) -> LR(32).
    // In our SVG:
    // Upper row indices: 1, 2, ..., 16 (L->R)
    // Lower row indices: 32, 31, ..., 17 (L->R)
    lowerTeeth.forEach((tooth, i) => {
        mapping[32 - i] = tooth;
    });

    fs.writeFileSync('/Users/audii3000/Documents/Personal Projects/xpress-scan/frontend/src/assets/teeth_mapping.json', JSON.stringify(mapping, null, 2));
    console.log('Mapping saved successfully with 32 teeth and NO background.');
}
