// 경로: winter-night/hooks/register.tsx
// 기능: 세션이 시작되면 겨울 밤 테마를 적용하고, 컨텍스트 사용률이 바뀔 때마다 배경의 눈 높이를 다시 그린다.

import type { Register, SessionContextUsage, SessionRateLimit } from 'claude-code'

import { LOOK, SCENE, UNPAINTED } from './look'
import { winterScene } from './scene'

/** 눈이 새 높이에 자리 잡는 데 걸리는 시간. 이 뒤에 다시 그려도 움직임이 되풀이되지 않는다 */
const SETTLE_MS = 8000

/** 화면에 보이는 값: 컨텍스트 사용률과 팻말 아랫판의 줄 */
type Gauge = { percent: number; lines: readonly string[] }

/** 한도 창의 이름을 팻말에 적을 말로 바꾼다 */
const LIMIT_LABELS: Readonly<Record<string, string>> = { five_hour: '5h', seven_day: 'weekly', spend_limit: 'spend' }

/** 팻말 아랫판에 들어가는 줄의 최대 개수 */
const MAX_LINES = 4

/**
 * 문서에 없는 한도 창(모델별 한도 등)도 세션이 알려 주면 이름을 다듬어 그대로 보여 준다.
 * 예: seven_day_fable → fable. SVG에 들어가므로 글자·숫자·빈칸만 남긴다
 */
function labelOf(kind: string): string {
  const known = LIMIT_LABELS[kind]

  if (known !== undefined) {
    return known
  }

  return kind
    .replace(/^(seven_day|five_hour|weekly|daily)_/, '')
    .replace(/_/g, ' ')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .slice(0, 8)
}

function limitLines(rateLimits: readonly SessionRateLimit[]): string[] {
  const lines: string[] = []

  for (const limit of rateLimits) {
    const label = labelOf(limit.kind)

    if (label !== '' && lines.length < MAX_LINES) {
      lines.push(`${label} ${Math.round(limit.percentUsed)}%`)
    }
  }

  return lines
}

/** 사용률이 아직 보고되지 않았으면 직전 값을 그대로 둔다 */
function gaugeOf(context: SessionContextUsage, rateLimits: readonly SessionRateLimit[], before: Gauge): Gauge {
  return { percent: Math.round(context.percent ?? before.percent), lines: limitLines(rateLimits) }
}

function isSame(a: Gauge, b: Gauge): boolean {
  return a.percent === b.percent && a.lines.join('|') === b.lines.join('|')
}

export const register: Register = on => {
  // 지금 그려진 값과, 눈이 움직이기 시작하는 높이
  let shown: Gauge = { percent: 0, lines: [] }
  let fromPercent = 0

  on('session.start', async ($, e, next) => {
    const usage = await $.session.usage()

    shown = gaugeOf(usage.context, usage.rateLimits, shown)
    fromPercent = shown.percent

    if (UNPAINTED !== undefined) {
      $.ui.toast(UNPAINTED)
    }

    const set = await $.theme.set(LOOK)

    if (!set.isDrawn) {
      $.ui.log(`winter-night backdrop is not drawn: ${set.reason}`, { to: 'debug' })
    }

    return next(e)
  })

  // 턴이 끝날 때마다, 그리고 한도 창이 움직일 때 엔진이 알려 준다
  on('session.measure', ($, e, next) => {
    const now = gaugeOf(e.context, e.rateLimits, shown)

    if (!isSame(now, shown)) {
      fromPercent = shown.percent
      shown = now
      $.ui.invalidate('ui.render')

      const settled = now.percent

      $.clock.after(SETTLE_MS, () => {
        if (shown.percent === settled) {
          fromPercent = settled
        }
      })
    }

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    // 다른 모드의 배경은 건드리지 않는다
    if (e.props.plugin !== $.plugin.name || e.props.scene !== SCENE) {
      return next(e)
    }

    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }

    const { Svg } = $.ui.resolve(e)

    return (
      <Svg
        isInteractive
        alt={`A snowy winter night. The snow is piled as high as the context window is full: ${shown.percent}%`}
        source={winterScene({ percent: shown.percent, fromPercent, signLines: shown.lines })}
      />
    )
  })
}
