import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = resolve(__dirname, '../public/icons/icon.svg')
const svgBuffer = readFileSync(svgPath)

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const { name, size } of sizes) {
  const out = resolve(__dirname, `../public/icons/${name}`)
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(out)
  console.log(`✓ ${name} (${size}×${size})`)
}
