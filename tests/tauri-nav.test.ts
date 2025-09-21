import { mapNavToPath } from '@/lib/tauri-nav'

describe('mapNavToPath', () => {
  test('home maps to /', () => {
    expect(mapNavToPath('home', 'abc')).toBe('/')
    expect(mapNavToPath('/', 'abc')).toBe('/')
  })

  test('settings maps to /settings', () => {
    expect(mapNavToPath('settings', 'abc')).toBe('/settings')
  })

  test('charts uses activeTankId or / fallback', () => {
    expect(mapNavToPath('charts', 'abc')).toBe('/tanks?tankId=abc')
    expect(mapNavToPath('charts', null)).toBe('/tanks')
  })

  test('report uses activeTankId or / fallback', () => {
    expect(mapNavToPath('report', 'abc')).toBe('/tanks/report?tankId=abc')
    expect(mapNavToPath('report', undefined)).toBe('/tanks/report')
  })

  test('passes through explicit paths', () => {
    expect(mapNavToPath('/tanks/xyz', 'abc')).toBe('/tanks/xyz')
  })
})
