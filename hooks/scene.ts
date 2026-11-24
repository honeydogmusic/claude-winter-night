// 경로: winter-night/hooks/scene.ts
// 기능: 겨울 밤 배경 SVG 문자열을 만든다. 컨텍스트 사용률에 따라 쌓인 눈의 높이와 눈발의 굵기가 달라진다.

/** 장면을 그리는 데 필요한 값 */
export type SceneInput = {
  /** 지금 컨텍스트 사용률, 0~100 */
  percent: number
  /** 직전 사용률. 눈이 이 높이에서 지금 높이로 움직인다 */
  fromPercent: number
  /** 팻말 아래 판에 적을 줄 (플랜 한도 등), 없으면 판을 그리지 않는다 */
  signLines: readonly string[]
}

const WIDTH = 1600
const HEIGHT = 1000

/** 눈 색 */
const SNOW = '#dde6fb'

/** 눈 위에 서는 것들의 가로 자리 */
const SIGN_X = 1320
// 왼쪽 240까지는 앱의 세션 목록이 덮으므로 그 오른쪽에 모아 둔다
const SNOWMAN_X = 286
const CAMPFIRE_X = 396
const TREE_X = 524
const GIFTS_X = 552

/** 소수 첫째 자리까지만 남겨 SVG 길이를 줄인다 */
function n(value: number): string {
  return String(Math.round(value * 10) / 10)
}

function clampPercent(percent: number): number {
  return Math.min(100, Math.max(0, percent))
}

/** 씨앗이 같으면 항상 같은 수열을 내는 난수기. 다시 그려도 별과 눈송이가 제자리에 있게 한다 */
function seeded(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 사용률 0%일 때 925, 100%일 때 665: 쌓인 눈의 가운데 높이 */
function pileTop(percent: number): number {
  return 925 - 2.6 * clampPercent(percent)
}

/** 눈 더미의 윗선. 양쪽 가장자리로 갈수록 높게 쌓이고 잔물결이 있다 */
function driftY(x: number, top: number, phase: number): number {
  const edge = ((x - WIDTH / 2) / (WIDTH / 2)) ** 2

  return top - 46 * edge + 12 * Math.sin(x / 170 + phase) + 6 * Math.sin(x / 61 + phase * 2)
}

function driftPath(top: number, phase: number): string {
  let d = `M-40 1320L-40 ${n(driftY(-40, top, phase))}`

  for (let x = -20; x <= WIDTH + 40; x += 20) {
    d += `L${x} ${n(driftY(x, top, phase))}`
  }

  return `${d}L${WIDTH + 40} 1320Z`
}

function stars(): string {
  const random = seeded(11)
  let out = ''

  for (let i = 0; i < 72; i += 1) {
    const x = random() * WIDTH
    const y = random() * 540
    const r = 0.6 + random() * 1.1
    const opacity = 0.45 + random() * 0.5

    out += `<circle class="t${i % 3}" cx="${n(x)}" cy="${n(y)}" r="${n(r)}" opacity="${n(opacity)}"/>`
  }

  return `<g fill="#e9eeff">${out}</g>`
}

function moon(): string {
  return (
    '<circle cx="1452" cy="150" r="170" fill="url(#halo)"/>' +
    '<circle cx="1452" cy="150" r="44" fill="#f4f0dc"/>' +
    '<g fill="#d9d3bb" opacity="0.6"><circle cx="1438" cy="138" r="9"/><circle cx="1466" cy="162" r="6"/><circle cx="1458" cy="130" r="4"/><circle cx="1436" cy="166" r="4"/></g>'
  )
}

type Point = readonly [number, number]

/** 능선 한 겹과, 높은 봉우리마다 얹은 눈 */
function ridge(points: readonly Point[], fill: string, capOpacity: number): string {
  const line = points.map(([x, y]) => `L${x} ${y}`).join('')
  let caps = ''

  for (let i = 1; i < points.length - 1; i += 1) {
    const before = points[i - 1]
    const peak = points[i]
    const after = points[i + 1]

    if (!before || !peak || !after || peak[1] >= before[1] || peak[1] >= after[1]) {
      continue
    }

    const drop = 34
    const tl = drop / (before[1] - peak[1])
    const tr = drop / (after[1] - peak[1])
    const lx = peak[0] + (before[0] - peak[0]) * tl
    const rx = peak[0] + (after[0] - peak[0]) * tr
    const y = peak[1] + drop
    const at = (t: number): number => lx + (rx - lx) * t

    caps += `<path d="M${peak[0]} ${peak[1]}L${n(rx)} ${y}L${n(at(0.72))} ${y - 9}L${n(at(0.52))} ${y + 5}L${n(at(0.3))} ${y - 8}L${n(lx)} ${y}Z"/>`
  }

  return `<path d="M0 ${HEIGHT}${line}L${WIDTH} ${HEIGHT}Z" fill="${fill}"/><g fill="#c9d3f2" opacity="${capOpacity}">${caps}</g>`
}

const FAR_RIDGE: readonly Point[] = [[0, 640], [140, 520], [260, 600], [420, 470], [560, 590], [700, 500], [860, 610], [1010, 480], [1160, 600], [1300, 510], [1450, 590], [1600, 500]]
const NEAR_RIDGE: readonly Point[] = [[0, 720], [180, 640], [330, 700], [520, 610], [690, 705], [880, 650], [1040, 715], [1220, 620], [1400, 700], [1600, 640]]

const TIERS = 4

/** 소나무 한 단의 모양: 꼭짓점 높이, 단의 세로 길이, 밑변의 반폭 */
function tierShape(base: number, height: number, tier: number): { apex: number; span: number; half: number } {
  return {
    apex: base - height + tier * height * 0.19,
    span: height * 0.36,
    half: height * 0.23 * (0.42 + (0.58 * (tier + 1)) / TIERS),
  }
}

/** 소나무 한 그루: 네 단의 가지와 단마다 얹힌 눈 */
function pine(x: number, base: number, height: number, tone: string, hasSnow: boolean): string {
  let body = ''
  let snow = ''

  for (let tier = 0; tier < TIERS; tier += 1) {
    const { apex, span, half } = tierShape(base, height, tier)
    const bottom = apex + span

    body += `<path d="M${n(x)} ${n(apex)}L${n(x + half)} ${n(bottom)}L${n(x - half)} ${n(bottom)}Z"/>`
    snow += `<path d="M${n(x)} ${n(apex)}L${n(x + half * 0.55)} ${n(apex + span * 0.55)}L${n(x + half * 0.2)} ${n(apex + span * 0.42)}L${n(x)} ${n(apex + span * 0.6)}L${n(x - half * 0.25)} ${n(apex + span * 0.4)}L${n(x - half * 0.55)} ${n(apex + span * 0.55)}Z"/>`
  }

  const trunk = `<rect x="${n(x - height * 0.025)}" y="${n(base - height * 0.1)}" width="${n(height * 0.05)}" height="${n(height * 0.12)}" fill="#1c1622"/>`

  return `${trunk}<g fill="${tone}">${body}</g>${hasSnow ? `<g fill="${SNOW}" opacity="0.88">${snow}</g>` : ''}`
}

/** 장식 전구의 색. 순서대로 돌려 쓴다 */
const BULBS: readonly string[] = ['#ff6b5e', '#ffd166', '#6fd3ff', '#8be28b', '#ff9de1']

/** 트리 꼭대기의 별과 그 둘레의 빛 */
function star(cx: number, cy: number, outer: number): string {
  const points: string[] = []

  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : outer * 0.44
    const angle = (Math.PI / 5) * i - Math.PI / 2

    points.push(`${n(cx + radius * Math.cos(angle))},${n(cy + radius * Math.sin(angle))}`)
  }

  return `<circle class="glow" cx="${n(cx)}" cy="${n(cy)}" r="${n(outer * 2.8)}" fill="url(#lamp)"/><polygon class="glow" points="${points.join(' ')}" fill="#ffe08a"/>`
}

/** 크리스마스 트리: 소나무에 단마다 늘어진 금빛 줄과 전구, 꼭대기의 별 */
function christmasTree(x: number, base: number, height: number): string {
  const sag = 12
  let strings = ''
  let bulbs = ''
  let count = 0

  for (let tier = 0; tier < TIERS; tier += 1) {
    const { apex, span, half } = tierShape(base, height, tier)
    const reach = half * 0.62
    const y = apex + span * 0.76
    const lights = tier * 2 + 3

    strings += `<path d="M${n(x - reach)} ${n(y)}Q${n(x)} ${n(y + sag * 2)} ${n(x + reach)} ${n(y)}"/>`

    for (let i = 0; i < lights; i += 1) {
      const t = (i + 0.5) / lights
      const bx = n(x - reach + 2 * reach * t)
      const by = n(y + 4 * sag * t * (1 - t))
      const color = BULBS[count % BULBS.length] ?? '#ffd166'

      bulbs += `<g class="bulb b${count % 3}" fill="${color}"><circle cx="${bx}" cy="${by}" r="11" opacity="0.3"/><circle cx="${bx}" cy="${by}" r="4.6"/></g>`
      count += 1
    }
  }

  return (
    pine(x, base, height, '#0e3434', true) +
    `<g fill="none" stroke="#d9b45a" stroke-width="1.6" opacity="0.85">${strings}</g>` +
    bulbs +
    star(x, base - height - 4, 15)
  )
}

/** 리본을 맨 선물 상자 하나 */
function giftBox(left: number, ground: number, size: number, color: string): string {
  const top = ground - size + 5
  const middle = left + size / 2

  return (
    `<rect x="${n(left)}" y="${n(top)}" width="${size}" height="${size}" rx="2" fill="${color}"/>` +
    `<path d="M${n(middle)} ${n(top)}V${n(top + size)}M${n(left)} ${n(top + size * 0.42)}H${n(left + size)}" stroke="#f3d27a" stroke-width="3.5"/>` +
    `<g fill="#f3d27a"><circle cx="${n(middle - 4)}" cy="${n(top - 2)}" r="4"/><circle cx="${n(middle + 4)}" cy="${n(top - 2)}" r="4"/></g>`
  )
}

/** 트리 앞 눈 위에 놓인 선물 두 개 */
function gifts(ground: number): string {
  return giftBox(GIFTS_X, ground, 30, '#c2473f') + giftBox(GIFTS_X + 36, ground, 22, '#3f8f6b')
}

/** 눈 위의 모닥불: 눈에 번지는 불빛, 장작, 세 겹의 불꽃, 돌, 날리는 불티 */
function campfire(ground: number): string {
  const x = CAMPFIRE_X
  const g = ground + 6

  return (
    `<ellipse class="glow" cx="${x}" cy="${n(g - 6)}" rx="170" ry="62" fill="url(#fire)"/>` +
    `<g fill="#4a3020"><rect x="${x - 36}" y="${n(g - 16)}" width="72" height="11" rx="5" transform="rotate(13 ${x} ${n(g - 10)})"/><rect x="${x - 36}" y="${n(g - 16)}" width="72" height="11" rx="5" transform="rotate(-13 ${x} ${n(g - 10)})"/></g>` +
    `<path class="flame l0" d="M${x - 24} ${n(g - 12)}Q${x - 32} ${n(g - 44)} ${x - 9} ${n(g - 62)}Q${x - 8} ${n(g - 84)} ${x + 2} ${n(g - 98)}Q${x + 7} ${n(g - 76)} ${x + 18} ${n(g - 62)}Q${x + 32} ${n(g - 40)} ${x + 23} ${n(g - 12)}Z" fill="#ef7d22"/>` +
    `<path class="flame l1" d="M${x - 15} ${n(g - 12)}Q${x - 20} ${n(g - 36)} ${x - 4} ${n(g - 50)}Q${x - 2} ${n(g - 64)} ${x + 3} ${n(g - 74)}Q${x + 6} ${n(g - 58)} ${x + 13} ${n(g - 48)}Q${x + 21} ${n(g - 32)} ${x + 15} ${n(g - 12)}Z" fill="#f9b233"/>` +
    `<path class="flame l2" d="M${x - 7} ${n(g - 12)}Q${x - 10} ${n(g - 26)} ${x} ${n(g - 44)}Q${x + 10} ${n(g - 26)} ${x + 8} ${n(g - 12)}Z" fill="#ffe9a6"/>` +
    `<g fill="#4c5372"><ellipse cx="${x - 36}" cy="${n(g - 3)}" rx="10" ry="6"/><ellipse cx="${x - 17}" cy="${n(g + 3)}" rx="11" ry="6"/><ellipse cx="${x + 5}" cy="${n(g + 4)}" rx="10" ry="6"/><ellipse cx="${x + 25}" cy="${n(g + 2)}" rx="10" ry="6"/><ellipse cx="${x + 39}" cy="${n(g - 4)}" rx="9" ry="6"/></g>` +
    `<g fill="#ffd27a"><circle class="spark k0" cx="${x - 6}" cy="${n(g - 96)}" r="1.8" opacity="0.5"/><circle class="spark k1" cx="${x + 9}" cy="${n(g - 104)}" r="1.4" opacity="0.4"/><circle class="spark k2" cx="${x + 1}" cy="${n(g - 118)}" r="1.6" opacity="0.3"/></g>`
  )
}

/** 먼 숲: 작은 나무의 실루엣 */
function farForest(): string {
  const random = seeded(23)
  let out = ''

  for (let i = 0; i < 30; i += 1) {
    const x = random() * WIDTH
    const height = 46 + random() * 52

    out += pine(x, 792 + random() * 26, height, '#101a3c', false)
  }

  return out
}

/** 오두막: 불 켜진 창, 눈 덮인 지붕, 굴뚝 연기 */
function cabin(): string {
  // 낮은 눈에는 창이 보이고 눈이 쌓이면 지붕부터 남도록, 조금 키워 언덕 위로 올려 둔다
  return (
    '<g transform="translate(-406.2 -262.5) scale(1.25)">' +
    '<ellipse class="glow" cx="1496" cy="862" rx="96" ry="64" fill="url(#lamp)"/>' +
    '<rect x="1452" y="815" width="130" height="115" fill="#3a2a2c"/>' +
    '<g stroke="#2b1f22" stroke-width="2"><path d="M1452 840H1582M1452 866H1582M1452 892H1582"/></g>' +
    '<rect x="1556" y="752" width="16" height="42" fill="#30242a"/>' +
    `<path d="M1552 754Q1564 742 1576 754L1576 758L1552 758Z" fill="${SNOW}"/>` +
    '<path d="M1438 822L1517 740L1596 822Z" fill="#2a1f24"/>' +
    `<path d="M1430 824L1517 732L1604 824L1591 828L1517 752L1443 828Z" fill="${SNOW}"/>` +
    '<rect x="1478" y="843" width="36" height="36" rx="2" fill="#2b1f22"/>' +
    '<rect class="glow" x="1481" y="846" width="30" height="30" fill="#ffc66b"/>' +
    '<path d="M1496 846V876M1481 861H1511" stroke="#2b1f22" stroke-width="2.5"/>' +
    `<path d="M1476 880H1516L1513 885H1479Z" fill="${SNOW}"/>` +
    '<rect x="1535" y="862" width="26" height="68" fill="#241a1e"/>' +
    '<circle cx="1555" cy="898" r="2" fill="#c9a25a"/>' +
    '<g fill="#c9d1ea"><circle class="smoke s0" cx="1564" cy="738" r="9" opacity="0.2"/><circle class="smoke s1" cx="1558" cy="716" r="12" opacity="0.14"/><circle class="smoke s2" cx="1550" cy="692" r="15" opacity="0.08"/></g>' +
    '</g>'
  )
}

/** 눈 위에 꽂힌 나무 팻말: 윗판은 컨텍스트 사용률, 아랫판은 플랜 한도 */
function sign(percent: number, lines: readonly string[], ground: number): string {
  const x = SIGN_X
  const top = ground - 128
  let lower = ''

  if (lines.length > 0) {
    const height = lines.length * 15 + 9
    const rows = lines
      .map((line, row) => `<text x="${x}" y="${n(top + 66 + row * 15)}" font-size="11" fill="#f1e6cf">${line}</text>`)
      .join('')

    lower = `<rect x="${x - 50}" y="${n(top + 52)}" width="100" height="${height}" rx="4" fill="#5d4130" stroke="#3a281d" stroke-width="1.5"/>${rows}`
  }

  return (
    `<rect x="${x - 4}" y="${n(top + 8)}" width="8" height="170" fill="#4a3426"/>` +
    `<rect x="${x - 56}" y="${n(top)}" width="112" height="48" rx="5" fill="#6b4a34" stroke="#3a281d" stroke-width="1.5"/>` +
    `<path d="M${x - 58} ${n(top + 2)}Q${x - 30} ${n(top - 11)} ${x} ${n(top - 6)}Q${x + 32} ${n(top - 12)} ${x + 58} ${n(top + 2)}L${x + 54} ${n(top + 6)}L${x - 54} ${n(top + 6)}Z" fill="${SNOW}"/>` +
    `<text x="${x}" y="${n(top + 29)}" font-size="24" font-weight="700" fill="#fbf3df">${Math.round(percent)}%</text>` +
    `<text x="${x}" y="${n(top + 42)}" font-size="10.5" letter-spacing="0.6" fill="#e3d4b8">context</text>` +
    lower
  )
}

/** 눈 위에 선 눈사람 */
function snowman(ground: number): string {
  const x = SNOWMAN_X
  const y = ground

  return (
    `<g stroke="#5a4030" stroke-width="3" stroke-linecap="round"><path d="M${x - 26} ${n(y - 58)}L${x - 58} ${n(y - 80)}M${x + 26} ${n(y - 58)}L${x + 60} ${n(y - 76)}"/></g>` +
    `<g fill="#eef3ff" stroke="#b9c6ea" stroke-width="1.5"><circle cx="${x}" cy="${n(y - 30)}" r="36"/><circle cx="${x}" cy="${n(y - 84)}" r="24"/></g>` +
    `<path d="M${x - 22} ${n(y - 68)}Q${x} ${n(y - 58)} ${x + 22} ${n(y - 68)}L${x + 20} ${n(y - 60)}Q${x} ${n(y - 50)} ${x - 20} ${n(y - 60)}Z" fill="#c2473f"/>` +
    `<rect x="${x + 10}" y="${n(y - 62)}" width="9" height="26" rx="2" fill="#c2473f"/>` +
    `<g fill="#20263f"><circle cx="${x - 8}" cy="${n(y - 90)}" r="2.6"/><circle cx="${x + 8}" cy="${n(y - 90)}" r="2.6"/><circle cx="${x}" cy="${n(y - 44)}" r="2.6"/><circle cx="${x}" cy="${n(y - 28)}" r="2.6"/><circle cx="${x}" cy="${n(y - 12)}" r="2.6"/></g>` +
    `<path d="M${x} ${n(y - 86)}L${x + 22} ${n(y - 81)}L${x} ${n(y - 78)}Z" fill="#e98a3c"/>` +
    `<rect x="${x - 26}" y="${n(y - 110)}" width="52" height="6" rx="2" fill="#20263f"/>` +
    `<rect x="${x - 16}" y="${n(y - 138)}" width="32" height="30" rx="2" fill="#20263f"/>` +
    `<rect x="${x - 16}" y="${n(y - 118)}" width="32" height="6" fill="#c2473f"/>`
  )
}

type FlakeLayer = {
  id: string
  seed: number
  count: number
  minRadius: number
  maxRadius: number
  opacity: number
  /** 읽는 자리를 가리지 않도록 양쪽 가장자리에만 내리게 한다 */
  edgesOnly: boolean
}

/** 눈송이 한 겹. 화면 높이만큼 위에 한 벌을 더 그려, 한 바퀴 내려와도 끊기지 않게 한다 */
function flakes(layer: FlakeLayer): string {
  const random = seeded(layer.seed)
  let out = ''

  for (let i = 0; i < layer.count; i += 1) {
    let x = random() * WIDTH

    if (layer.edgesOnly) {
      const offset = random() * 430

      x = random() < 0.5 ? offset : WIDTH - offset
    }

    const y = random() * HEIGHT
    const r = layer.minRadius + random() * (layer.maxRadius - layer.minRadius)

    out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}"/><circle cx="${n(x)}" cy="${n(y - HEIGHT)}" r="${n(r)}"/>`
  }

  return `<g class="fall f${layer.id}"><g class="sway w${layer.id}" fill="#eef2ff" opacity="${layer.opacity}">${out}</g></g>`
}

function style(shift: number): string {
  // 눈이 쌓일 때보다 녹을 때 더 천천히 움직인다
  const seconds = shift < 0 ? 7 : 4
  const settle = shift === 0 ? '' : `.pile{animation:settle ${seconds}s ease-out 1}@keyframes settle{from{transform:translateY(${n(shift)}px)}}`

  return (
    'text{font-family:system-ui,sans-serif;text-anchor:middle}' +
    '.fall{animation:fall linear infinite}.fa{animation-duration:66s}.fb{animation-duration:47s}.fc{animation-duration:33s}' +
    '.sway{animation:sway ease-in-out infinite alternate}.wa{animation-duration:19s}.wb{animation-duration:15s}.wc{animation-duration:12s}' +
    '.t0{animation:twinkle 7s ease-in-out infinite alternate}.t1{animation:twinkle 9s ease-in-out -4s infinite alternate}.t2{animation:twinkle 11s ease-in-out -7s infinite alternate}' +
    '.glow{animation:glow 6s ease-in-out infinite alternate}' +
    '.smoke{animation:smoke 13s ease-out infinite}.s1{animation-delay:-4s}.s2{animation-delay:-8s}' +
    '.bulb{animation:bulb ease-in-out infinite alternate}.b0{animation-duration:3.1s}.b1{animation-duration:4.3s;animation-delay:-2s}.b2{animation-duration:5.2s;animation-delay:-1s}' +
    '.flame{transform-box:fill-box;transform-origin:50% 100%;animation:flame ease-in-out infinite alternate}.l0{animation-duration:1.9s}.l1{animation-duration:1.5s;animation-delay:-.7s}.l2{animation-duration:1.3s;animation-delay:-.3s}' +
    '.spark{animation:spark 6s ease-out infinite}.k1{animation-delay:-2s}.k2{animation-delay:-4s}' +
    settle +
    '@keyframes bulb{from{opacity:.65}to{opacity:1}}' +
    '@keyframes flame{from{transform:scale(.94,.9) skewX(-3deg)}to{transform:scale(1.04,1.08) skewX(3deg)}}' +
    '@keyframes spark{0%{transform:translate(0,0);opacity:0}15%{opacity:.9}100%{transform:translate(14px,-110px);opacity:0}}' +
    `@keyframes fall{from{transform:translateY(0)}to{transform:translateY(${HEIGHT}px)}}` +
    '@keyframes sway{from{transform:translateX(-22px)}to{transform:translateX(16px)}}' +
    '@keyframes twinkle{from{opacity:.35}to{opacity:1}}' +
    '@keyframes glow{from{opacity:.78}to{opacity:1}}' +
    '@keyframes smoke{0%{transform:translate(8px,30px);opacity:0}25%{opacity:.26}100%{transform:translate(-22px,-70px);opacity:0}}' +
    '@media (prefers-reduced-motion: reduce){*{animation:none!important}}'
  )
}

/** 쌓인 눈의 색. 윗선만 달빛에 밝고 아래로 갈수록 밤빛에 잠겨, 높이 쌓여도 글자 뒤가 허옇게 뜨지 않는다 */
function snowGradient(top: number): string {
  return `<linearGradient id="snow" gradientUnits="userSpaceOnUse" x1="0" y1="${n(top - 50)}" x2="0" y2="${n(top + 330)}"><stop offset="0" stop-color="#e9efff"/><stop offset="0.2" stop-color="#b3bfe8"/><stop offset="0.55" stop-color="#7c8bc2"/><stop offset="1" stop-color="#55649f"/></linearGradient>`
}

const DEFS =
  '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#090e2a"/><stop offset="0.45" stop-color="#121a44"/><stop offset="0.8" stop-color="#222a5c"/><stop offset="1" stop-color="#2a3168"/></linearGradient>' +
  '<radialGradient id="halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0.2" stop-color="#f4f0dc" stop-opacity="0.26"/><stop offset="0.5" stop-color="#b9c4ee" stop-opacity="0.1"/><stop offset="1" stop-color="#b9c4ee" stop-opacity="0"/></radialGradient>' +
  '<radialGradient id="lamp" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffb65c" stop-opacity="0.34"/><stop offset="1" stop-color="#ffb65c" stop-opacity="0"/></radialGradient>' +
  '<radialGradient id="fire" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffb04a" stop-opacity="0.5"/><stop offset="0.5" stop-color="#ff8a2a" stop-opacity="0.18"/><stop offset="1" stop-color="#ff8a2a" stop-opacity="0"/></radialGradient>'

/** 장면 전체. 같은 입력이면 항상 같은 문자열이 나온다 */
export function winterScene(input: SceneInput): string {
  const percent = clampPercent(input.percent)
  const top = pileTop(percent)
  // 직전 높이에서 지금 높이로: 양수면 아래에서 올라오고(쌓임), 음수면 위에서 내려온다(녹음)
  const shift = pileTop(input.fromPercent) - top
  // 컨텍스트가 찰수록 눈발이 굵어진다
  const far: FlakeLayer = { id: 'a', seed: 31, count: Math.round(46 + percent * 0.5), minRadius: 1, maxRadius: 1.7, opacity: 0.4, edgesOnly: false }
  const middle: FlakeLayer = { id: 'b', seed: 41, count: Math.round(22 + percent * 0.45), minRadius: 1.7, maxRadius: 2.5, opacity: 0.6, edgesOnly: true }
  const near: FlakeLayer = { id: 'c', seed: 51, count: Math.round(10 + percent * 0.3), minRadius: 2.5, maxRadius: 3.7, opacity: 0.8, edgesOnly: true }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" font-family="system-ui, sans-serif" color="#888"><style>${style(shift)}</style><defs>${DEFS}${snowGradient(top)}</defs>` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#sky)"/>` +
    stars() +
    moon() +
    ridge(FAR_RIDGE, '#1a2350', 0.5) +
    ridge(NEAR_RIDGE, '#141b42', 0.28) +
    farForest() +
    flakes(far) +
    pine(1150, 950, 190, '#0f2742', true) +
    pine(676, 955, 210, '#0f2742', true) +
    pine(640, 950, 150, '#0f2742', true) +
    pine(1010, 950, 160, '#0f2742', true) +
    pine(1592, 965, 390, '#0c2038', true) +
    cabin() +
    pine(1232, 965, 250, '#0c2038', true) +
    pine(95, 975, 440, '#0c2038', true) +
    christmasTree(TREE_X, 965, 380) +
    flakes(middle) +
    `<g class="pile"><path d="${driftPath(top - 20, 2.1)}" fill="#6f7fb8"/>` +
    sign(percent, input.signLines, driftY(SIGN_X, top, 0.6)) +
    snowman(driftY(SNOWMAN_X, top, 0.6)) +
    gifts(driftY(GIFTS_X + 26, top, 0.6)) +
    `<path d="${driftPath(top, 0.6)}" fill="url(#snow)"/>` +
    campfire(driftY(CAMPFIRE_X, top, 0.6)) +
    '</g>' +
    flakes(near) +
    '</svg>'
  )
}
