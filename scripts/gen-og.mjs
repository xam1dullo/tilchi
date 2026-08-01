import sharp from 'sharp'

const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#F5EFE4"/>
  <rect y="0" width="1200" height="10" fill="#A8452E"/>
  <rect x="96" y="96" width="64" height="64" rx="18" fill="#A8452E"/>
  <text x="128" y="143" font-family="Georgia, serif" font-size="42" font-weight="700" font-style="italic" text-anchor="middle" fill="#F5EFE4">t</text>
  <text x="176" y="146" font-family="Georgia, serif" font-size="46" font-weight="500" letter-spacing="-1" fill="#171512">tilchi</text>
  <text x="96" y="330" font-family="Georgia, serif" font-size="74" font-weight="500" letter-spacing="-1" fill="#171512">Ingliz tilini</text>
  <text x="96" y="416" font-family="Georgia, serif" font-size="74" font-weight="500" font-style="italic" letter-spacing="-1" fill="#A8452E">haqiqiy o'qituvchi</text>
  <text x="96" y="502" font-family="Georgia, serif" font-size="74" font-weight="500" letter-spacing="-1" fill="#171512">bilan o'rganing.</text>
  <text x="96" y="566" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#3D372F">CELTA · IELTS 7.0 · C1 — birinchi dars bepul</text>
</svg>`

await sharp(Buffer.from(svg)).png().toFile('public/og.png')
console.log('public/og.png written')
