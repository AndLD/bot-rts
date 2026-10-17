import { render, screen } from '@testing-library/react'
import { Button, ConfigProvider } from 'antd'
import { BUTTON_PADDING, DISABLED_BACKGROUND, DISABLED_TEXT, buttonTheme } from './buttonTheme'

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

describe('buttonTheme', () => {
  it('keeps a disabled label readable (WCAG AA, 4.5:1) on an opaque surface', () => {
    expect(DISABLED_BACKGROUND).toMatch(/^#[0-9a-f]{6}$/)
    expect(contrast(DISABLED_TEXT, DISABLED_BACKGROUND)).toBeGreaterThanOrEqual(4.5)
    expect(buttonTheme.token).toMatchObject({
      colorBgContainerDisabled: DISABLED_BACKGROUND,
      colorTextDisabled: DISABLED_TEXT
    })
  })

  it('sets the horizontal padding of every button size', () => {
    expect(buttonTheme.components?.Button).toEqual({
      paddingInlineSM: BUTTON_PADDING.small,
      paddingInline: BUTTON_PADDING.middle,
      paddingInlineLG: BUTTON_PADDING.large
    })
    expect(BUTTON_PADDING.small).toBeGreaterThan(0)
  })

  it('reaches a rendered disabled button', () => {
    render(
      <ConfigProvider theme={buttonTheme}>
        <Button disabled>Save</Button>
      </ConfigProvider>
    )

    const rules = Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent ?? '')
      .join('')
      .toLowerCase()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(rules).toContain(DISABLED_BACKGROUND)
    expect(rules).toContain(DISABLED_TEXT)
  })
})
