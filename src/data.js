import { aggregateShopping } from './services/ingredients.js'

export const today = new Date().toISOString().slice(0, 10)
export const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const days = (date) => Math.ceil((new Date(`${date}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000)
export const config = {
  storageKey: 'family-recipe-keeper-v2', brand: '家味成长', subtitle: 'Family Kitchen', entityLabel: '菜谱', secondaryLabel: '每周菜单', historyLabel: '烹饪实践', historyTitle: '我的烹饪记录', heroTitle: '把每一顿饭，做成家的记忆。', heroCopy: '收藏菜谱、安排菜单，也记录每次变得更好的过程。', createLabel: '添加菜谱', dateLabel: '最近烹饪', locationLabel: '食材 / 调料', copyLabel: '调料清单', secondaryTitle: '本周菜单与采购清单', secondaryAction: '安排菜谱', secondaryDatePrefix: '周',
  nav: [{ id: 'overview', label: '总览' }, { id: 'documents', label: '我的菜谱' }, { id: 'history', label: '烹饪记录' }, { id: 'insurance', label: '每周菜单' }, { id: 'achievements', label: '挑战与榜单' }],
  metrics: [{ label: '菜谱总数', collection: 'documents', tone: 'green' }, { label: '本月烹饪次数', tone: 'peach', value: (s) => s.usages.filter((x) => x.date?.slice(0, 7) === today.slice(0, 7)).length }, { label: '平均评分', tone: 'red', value: (s) => (s.usages.length ? (s.usages.reduce((a, x) => a + Number(x.score || 0), 0) / s.usages.length).toFixed(1) : '0.0') }, { label: '采购完成率', tone: 'blue', value: (s) => { const total = s.policies.reduce((a, p) => a + (p.shopping?.length || 0), 0); const done = s.policies.reduce((a, p) => a + (p.shopping?.filter((x) => x.done).length || 0), 0); return total ? `${Math.round((done / total) * 100)}%` : '0%' } }],
  form: { title: '添加新菜谱', collection: 'documents', fields: [['name', '菜名', '番茄牛腩'], ['category', '菜系', '家常'], ['holder', '难度', '中等'], ['number', '准备 / 烹饪时间', '20 / 60 分钟'], ['issued', '最近烹饪日期', today, 'date'], ['expires', '下次推荐日期', `${new Date().getFullYear()}-12-31`, 'date'], ['location', '食材清单', '建议填写，安排菜单时会自动汇总', '牛腩 500g、番茄 2 个'], ['copyLocation', '调料清单', '盐、生抽、八角'], ['notes', '小贴士', '小火慢炖更入味'] ] },
  categories: ['川菜', '粤菜', '湘菜', '家常', '西餐', '烘焙', '其他'], achievements: ['初次下厨', '菜谱收藏家', '烹饪达人', '零失败', '家庭大厨', '连续七天', '新菜探索者', '甜点大师', '采购有序', '味觉记录者', '分享达人', '厨房领航员']
}

export const seed = {
  documents: [
    { id: 'recipe-1', name: '番茄牛腩', category: '家常', holder: '中等', number: '20 / 60 分钟', issued: '2026-09-12', expires: '2026-10-12', location: '牛腩 500g、西红柿 2 个、洋葱 半个', copyLocation: '盐、生抽、八角', notes: '最后加一点番茄酱' },
    { id: 'recipe-2', name: '葱油拌面', category: '家常', holder: '简单', number: '10 / 15 分钟', issued: '2026-09-15', expires: '2026-11-01', location: '面条、小葱', copyLocation: '生抽、糖、油', notes: '葱段要小火慢熬' },
    { id: 'recipe-3', name: '抹茶巴斯克', category: '烘焙', holder: '困难', number: '30 / 45 分钟', issued: '2026-08-05', expires: '2026-09-20', location: '奶油奶酪、鸡蛋 2 枚、抹茶粉 10g', copyLocation: '糖、淡奶油', notes: '冷藏一夜口感最佳' },
    { id: 'recipe-4', name: '番茄炒蛋', category: '家常', holder: '简单', number: '5 / 10 分钟', issued: '2026-09-16', expires: '2026-10-20', location: '番茄 1 个、鸡蛋 3 枚', copyLocation: '盐、糖', notes: '鸡蛋炒至半熟先盛出' },
    { id: 'recipe-5', name: '蒜蓉西兰花', category: '家常', holder: '简单', number: '5 / 8 分钟', issued: '2026-09-10', expires: '2026-10-18', location: '', copyLocation: '蒜、盐、蚝油', notes: '西兰花先焯水更翠绿' },
  ],
  usages: [
    { id: 'cook-1', documentId: 'recipe-1', date: '2026-09-12', purpose: '周末晚餐', borrower: '林小满', status: '完成', score: 5, note: '家人说汤汁很香' },
    { id: 'cook-2', documentId: 'recipe-2', date: '2026-09-15', purpose: '工作日晚餐', borrower: '周予安', status: '完成', score: 4, note: '下次多加葱' },
  ],
  policies: [],
}

function makePlan(id, weekday, recipeIds, doneKeys = []) {
  const recipes = recipeIds
    .map((rid) => seed.documents.find((r) => r.id === rid))
    .filter(Boolean)
  const { items, missing } = aggregateShopping(recipes)
  return {
    id,
    weekday,
    title: `${weekday} · ${recipes.map((r) => r.name).join(' + ')}`,
    recipes: recipes.map((r) => ({ id: r.id, name: r.name })),
    expires: weekday,
    shopping: items.map((it) => ({ ...it, done: doneKeys.includes(it.key) })),
    missing,
    createdAt: new Date().toISOString(),
  }
}

seed.policies = [
  makePlan('menu-1', '周一', ['recipe-1', 'recipe-4'], ['牛腩', '洋葱', '鸡蛋']),
  makePlan('menu-2', '周三', ['recipe-2', 'recipe-5'], ['面条']),
]

export { days }
