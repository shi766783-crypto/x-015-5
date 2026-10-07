// 食材清单解析、同义词归一与多菜合并去重

const CN_NUM = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 半: 0.5 }

// 同物异名：统一成采购单上的标准写法
const SYNONYMS = {
  西红柿: '番茄',
  番茄仔: '番茄',
  土豆: '土豆', 马铃薯: '土豆', 洋芋: '土豆',
  小葱: '葱', 香葱: '葱', 大葱: '葱',
  大蒜: '蒜', 蒜瓣: '蒜', 蒜头: '蒜',
  西蓝花: '西兰花', 青花菜: '西兰花', 花椰菜: '花菜', 花菜: '花菜',
  鸡子: '鸡蛋',
  圣女果: '圣女果',
}

// 计量单位（长单位放前面，避免正则提前截断）
const UNITS = ['汤匙', '茶匙', '千克', '公斤', '毫升', '大勺', '小勺', '把', '根', '个', '颗', '粒', '瓣', '枚', '块', '片', '条', '只', '枝', '支', '袋', '瓶', '盒', '罐', '包', '杯', '勺', '斤', '两', '克', '升', 'kg', 'ml', 'g', 'l']
const NUM = '(?:\\d+(?:\\.\\d+)?|[一二两三四五六七八九半])'
const UNIT = `(?:${UNITS.join('|')})`
const TAIL_NUM = new RegExp(`^(.*?)\\s*(${NUM})\\s*(${UNIT})?\\s*$`)
const HEAD_NUM = new RegExp(`^(${NUM})\\s*(${UNIT})?\\s*(.+)$`)

// 质量统一换算到 g，体积统一换算到 ml，其余单位保留
const MASS_TO_G = { g: 1, 克: 1, kg: 1000, 千克: 1000, 公斤: 1000, 斤: 500, 两: 50 }
const VOL_TO_ML = { ml: 1, 毫升: 1, l: 1000, 升: 1000 }

export function hasIngredients(recipe) {
  return !!(recipe.location && recipe.location.trim())
}

export function normalizeName(raw) {
  let name = String(raw || '')
    .replace(/[（(][^）)]*[）)]/g, '') // 去掉括号备注，如“番茄（熟透的）”
    .replace(/[\s　]+/g, '')
    .replace(/(适量|少许)$/, '')
    .trim()
    .toLowerCase()
  name = SYNONYMS[name] || name
  return name
}

function toNumber(value) {
  if (value == null) return null
  if (typeof value === 'number') return value
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value)
  return CN_NUM[value] ?? null
}

// “牛腩 500g” / “番茄 2 个” / “洋葱 半个” / “2根胡萝卜” / “盐”
export function parseIngredient(token) {
  const raw = token.trim()
  let m = raw.match(TAIL_NUM)
  if (m && m[1].trim()) {
    return { raw, name: normalizeName(m[1]), qty: toNumber(m[2]), unit: m[3] || null }
  }
  m = raw.match(HEAD_NUM)
  if (m && m[3].trim()) {
    return { raw, name: normalizeName(m[3]), qty: toNumber(m[1]), unit: m[2] || null }
  }
  return { raw, name: normalizeName(raw), qty: null, unit: null }
}

export function parseIngredientList(text) {
  if (!text || !String(text).trim()) return []
  return String(text)
    .split(/[、,，;；\/\n\r]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map(parseIngredient)
    .filter((x) => x.name)
}

function baseUnit(unit) {
  if (unit && MASS_TO_G[unit] != null) return { key: 'g', factor: MASS_TO_G[unit] }
  if (unit && VOL_TO_ML[unit] != null) return { key: 'ml', factor: VOL_TO_ML[unit] }
  return { key: unit || '', factor: 1 }
}

function numText(qty) {
  if (qty === 0.5) return '半'
  return Number.isInteger(qty) ? String(qty) : String(Number(qty.toFixed(2)))
}

// 汇总多道菜的食材，按标准名合并去重
export function aggregateShopping(recipes = []) {
  const map = new Map()
  const missing = []

  for (const recipe of recipes) {
    if (!hasIngredients(recipe)) {
      missing.push({ id: recipe.id, name: recipe.name })
      continue
    }
    for (const ing of parseIngredientList(recipe.location)) {
      if (!map.has(ing.name)) map.set(ing.name, { name: ing.name, sources: [] })
      map.get(ing.name).sources.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        raw: ing.raw,
        qty: ing.qty,
        unit: ing.unit,
      })
    }
  }

  const items = []
  for (const [key, entry] of map) {
    const numeric = entry.sources.filter((s) => s.qty != null)
    const bases = new Set(numeric.map((s) => baseUnit(s.unit).key))

    let qty = null
    let unit = null
    let mixed = null

    if (bases.size === 1 && numeric.length)
{
      const base = bases.values().next().value
      qty = numeric.reduce((sum, s) => sum + s.qty * baseUnit(s.unit).factor, 0)
      if (base === 'g' && qty >= 1000) { qty = Number((qty / 1000).toFixed(2)); unit = 'kg' }
      else if (base === 'ml' && qty >= 1000) { qty = Number((qty / 1000).toFixed(2)); unit = 'L' }
      else unit = base
    } else if (bases.size > 1) {
      // 同名但单位无法互通（如“葱 1把”+“葱 2根”），保留各自原始用量
      mixed = [...new Set(numeric.map((s) => `${numText(s.qty)}${s.unit || ''}`))].join(' + ')
    }

    items.push({ key, name: entry.name, qty, unit, mixed, done: false, sources: entry.sources })
  }

  items.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
  return { items, missing }
}

export function formatAmount(item) {
  if (item.mixed) return item.mixed
  if (item.qty != null) {
    if (item.qty === 0.5) return `半${item.unit || ''}`
    return `${numText(item.qty)}${item.unit || ''}`
  }
  return '适量'
}

export function sourceTitle(item) {
  return item.sources.map((s) => `${s.recipeName}：${s.raw}`).join('\n')
}
