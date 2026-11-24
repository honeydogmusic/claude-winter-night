// 경로: winter-night/hooks/look.ts
// 기능: 겨울 밤 테마의 앱 색상과 배경 설정을 한 덩어리(LOOK)로 정의한다.

import type { ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'

/** 배경 장면의 이름. ui.render 훅이 이 이름으로 자기 장면인지 가린다 */
export const SCENE = 'winter-night'

// 밤하늘의 남색에서 뽑은 어두운 모드 전용 색. 표면은 서로 가깝게, 글자는 눈빛에 가깝게 둔다
const { theme, problems } = makeColors({
  label: 'Winter Night',
  only: 'dark',
  roles: { accent: '#5b9bd8', danger: '#d2574f', success: '#5fa777', warning: '#d9a441', pro: '#a487d6' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0e1530',
        'surface-1': '#131a39',
        'surface-2': '#171f41',
        'surface-3': '#1a2346',
        'text-primary': '#eef2fb',
        'text-secondary': '#c5cde2',
        'text-muted': '#9aa5c4',
      },
    },
  },
})

/** 데스크톱 앱이 이 색상을 통째로 거부하게 만드는 문제. 없으면 undefined */
export const UNPAINTED: string | undefined = problems.find(line => line.startsWith("Desktop won't paint"))

/** 테마 전체. 한 번의 $.theme.set 호출에 색과 배경을 함께 넘긴다 */
export const LOOK: ThemeSetArgs = {
  backdrop: { scene: SCENE, glass: { blur: 14, tint: '#0d1430', opacity: 0.58 } },
  overrideColorScheme: 'dark',
  colors: theme,
}
