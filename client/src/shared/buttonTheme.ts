import type { ThemeConfig } from 'antd'

// Horizontal padding of an Ant Design button, per size. The global reset (`* { padding: 0 }`) must never decide it
export const BUTTON_PADDING = { small: 8, middle: 16, large: 20 } as const

// An opaque disabled surface and a dark label on it: 6.2:1, above the 4.5:1 of WCAG AA. The stock tokens are translucent,
// so on the black game windows the surface vanished and the dark label (25 % black) could not be read
export const DISABLED_BACKGROUND = '#d9d9d9'
export const DISABLED_TEXT = '#4a4a4a'

// The shared look of every Ant Design button and disabled control, in one place instead of per button
export const buttonTheme: ThemeConfig = {
  token: {
    colorBgContainerDisabled: DISABLED_BACKGROUND,
    colorTextDisabled: DISABLED_TEXT
  },
  components: {
    Button: {
      paddingInlineSM: BUTTON_PADDING.small,
      paddingInline: BUTTON_PADDING.middle,
      paddingInlineLG: BUTTON_PADDING.large
    }
  }
}
