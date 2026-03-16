/**
 * Fix adaptive icon safe zone - scales icon to 66% and centers it
 * so it won't be cropped by circular/squircle masks on Android.
 * Android safe zone: center 72dp of 108dp canvas = ~66.7%
 */
const sharp = require('sharp');
const path = require('path');

const fs = require('fs');
const ASSETS = path.join(__dirname, '../assets');
const INPUT = path.join(ASSETS, 'adaptive-icon.png');
const TEMP = path.join(ASSETS, 'adaptive-icon-temp.png');
const OUTPUT = path.join(ASSETS, 'adaptive-icon.png');
const SIZE = 1024;
const SAFE_ZONE = 0.66; // 66% - keep content in center to avoid mask cropping

async function run() {
  const scaledSize = Math.round(SIZE * SAFE_ZONE);
  const offset = Math.round((SIZE - scaledSize) / 2);

  await sharp(INPUT)
    .resize(scaledSize, scaledSize)
    .extend({
      top: offset,
      bottom: offset,
      left: offset,
      right: offset,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(TEMP);

  fs.renameSync(TEMP, OUTPUT);
  console.log(`✔ Adaptive icon saved with ${Math.round(SAFE_ZONE * 100)}% safe zone`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
