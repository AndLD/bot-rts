import { RootShell } from './RootShell'

describe('RootShell', () => {
  it('is the document of a page, in the language of the page', () => {
    // An <html> element cannot be mounted inside the test page, so the element it returns is looked at
    const document = RootShell({ lang: 'ru', children: <p>content</p> })

    expect(document.type).toBe('html')
    expect(document.props.lang).toBe('ru')
    expect(document.props.children.type).toBe('body')
  })
})
