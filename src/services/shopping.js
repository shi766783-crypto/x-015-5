// 食材别名表：把常见不同写法归一到同一个名字，便于合并去重
const ALIASES = {
  西红柿: '番茄',
  马铃薯: '土豆', 洋芋: '土豆',
  番薯: '红薯', 地瓜: '红薯',
  芫荽: '香菜',
  蒜: '大蒜', 蒜头: '大蒜', 蒜瓣: '大蒜',
  生姜: '姜',
  圆葱: '洋葱',
  小葱: '葱', 香葱: '葱',
  青瓜: '黄瓜',
  卷心菜: '包菜', 洋白菜: '包菜',
  柿子椒: '青椒', 尖椒: '青椒'
}

const UNIT_ALIASES = { 克: 'g', 千克: 'kg', 毫升: 'ml', 升: 'l' }
const MASS = { g: 1, kg: 1000 }
const VOLUME = { ml: 1, l: 1000 }
const COUNT_UNITS = ['个', '只', '颗', '根', '片', '块', '条', '段', '枚', '瓣', '头', '把', '束', '袋', '盒', '罐', '杯', '勺', '汤匙', '茶匙']
const UNIT_PATTERN = ['千克', '毫升', ...Object.keys(UNIT_ALIASES), 'g', 'kg', 'ml', 'l', ...COUNT_UNITS].join('|')
const ITEM_RE = new RegExp(`^(.+?)[\\s:：]*(\\d+(?:\\.\\d+)?)\\s*(${UNIT_PATTERN})?$`, 'i')

function canonicalName(raw) {
  const name = raw
    .trim()
    .replace(/[【\[（(].*?[】\]）)]/g, '') // 去掉括号备注
    .replace(/\s+/g, '')
    .replace(/^[·•\-*]+/, '')
    .replace(/(适量|少许|按需|酌情)$/, '')
  return ALIASES[name] || name
}

function normalizeUnit(unit) {
  if (!unit) return ''
  const lower = unit.toLowerCase()
  return UNIT_ALIASES[unit] || UNIT_ALIASES[lower] || lower
}

// 把「牛腩 500g、番茄 2 个」这样的文本拆成 { name, qty, unit } 列表
export function parseIngredients(text) {
  if (!text || !text.trim()) return []
  return text
    .split(/[、,，;；|\n]+|\s*\/\s*/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const match = token.match(ITEM_RE)
      if (!match) return { name: canonicalName(token), qty: null, unit: '' }
      return { name: canonicalName(match[1]), qty: Number(match[2]), unit: normalizeUnit(match[3]) }
    })
    .filter((item) => item.name)
}

function bucketOf(unit) {
  if (MASS[unit]) return 'mass'
  if (VOLUME[unit]) return 'volume'
  return unit
}

function trimNum(value) {
  return Number(value.toFixed(1)).toString()
}

function formatAmounts(amounts) {
  const parts = []
  for (const [key, value] of amounts) {
    if (key === 'mass') parts.push(value >= 1000 ? `${trimNum(value / 1000)}kg` : `${trimNum(value)}g`)
    else if (key === 'volume') parts.push(value >= 1000 ? `${trimNum(value / 1000)}L` : `${trimNum(value)}ml`)
    else parts.push(key ? `${trimNum(value)} ${key}` : trimNum(value))
  }
  return parts.join(' + ')
}

// 合并多道菜谱的食材：同名（含别名）食材合并，同单位数量累加，记录来源菜谱
export function mergeIngredients(recipes) {
  const groups = new Map()
  for (const recipe of recipes) {
    for (const item of parseIngredients(recipe.location)) {
      let group = groups.get(item.name)
      if (!group) {
        group = { name: item.name, sources: [], amounts: new Map() }
        groups.set(item.name, group)
      }
      if (!group.sources.includes(recipe.name)) group.sources.push(recipe.name)
      if (item.qty == null) continue
      const bucket = bucketOf(item.unit)
      const base = bucket === 'mass' ? item.qty * MASS[item.unit] : bucket === 'volume' ? item.qty * VOLUME[item.unit] : item.qty
      const key = bucket === 'mass' || bucket === 'volume' ? bucket : item.unit
      group.amounts.set(key, (group.amounts.get(key) || 0) + base)
    }
  }
  const now = Date.now()
  return [...groups.values()].map((group, index) => ({
    id: `shop-${now}-${index}`,
    name: group.name,
    qty: formatAmounts(group.amounts),
    sources: group.sources,
    done: false
  }))
}
