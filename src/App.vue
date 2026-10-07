<script setup>
import { computed, ref } from 'vue'
import { Archive, Award, Bell, BookOpen, CalendarClock, ChevronRight, CircleAlert, FilePlus2, FolderLock, LayoutDashboard, Menu, Plus, RotateCcw, Search, ShieldCheck, ShoppingCart, TrendingUp, Trash2, UserRound, X } from 'lucide-vue-next'
import { config, days, weekDays } from './data'
import { useKeeper } from './composables/useKeeper'
import { aggregateShopping, formatAmount, hasIngredients, sourceTitle } from './services/ingredients'
const { state, add, update, remove, metrics, reset } = useKeeper()
const active = ref('overview'); const query = ref(''); const showForm = ref(false); const mobileOpen = ref(false); const draft = ref({})
const activeNav = computed(() => config.nav.find((x) => x.id === active.value))
const docs = computed(() => state.documents.filter((x) => `${x.name}${x.holder}${x.category}`.toLowerCase().includes(query.value.toLowerCase())))
const alerts = computed(() => state.documents.map((x) => ({ ...x, remaining: days(x.expires) })).filter((x) => x.remaining <= 90).sort((a, b) => a.remaining - b.remaining))
const borrowed = computed(() => state.usages.filter((x) => x.status === '借用中'))
const filledCount = computed(() => state.documents.filter((x) => x.location && x.copyLocation).length)
const completion = computed(() => Math.min(100, Math.round((filledCount.value / Math.max(state.documents.length, 1)) * 100)))

// —— 每周菜单 ——
const menus = computed(() => [...state.policies]
  .map((plan) => {
    const total = plan.shopping?.length || 0
    const doneCount = plan.shopping?.filter((x) => x.done).length || 0
    return { ...plan, total, doneCount, percent: total ? Math.round((doneCount / total) * 100) : 0 }
  })
  .sort((a, b) => weekDays.indexOf(a.weekday) - weekDays.indexOf(b.weekday)))
const shopTotal = computed(() => state.policies.reduce((a, p) => a + (p.shopping?.length || 0), 0))
const shopDone = computed(() => state.policies.reduce((a, p) => a + (p.shopping?.filter((x) => x.done).length || 0), 0))
const shopPercent = computed(() => (shopTotal.value ? Math.round((shopDone.value / shopTotal.value) * 100) : 0))
const warnCount = computed(() => state.policies.reduce((a, p) => a + (p.missing?.length || 0), 0))

function toggleItem(plan, item) {
  const shopping = plan.shopping.map((x) => (x.key === item.key ? { ...x, done: !x.done } : x))
  update('policies', plan.id, { shopping })
}
function removePlan(plan) {
  if (window.confirm(`确定移除「${plan.title}」吗？`)) remove('policies', plan.id)
}

// —— 安排菜谱弹窗 ——
const showPlanner = ref(false)
const picked = ref({}) // recipeId -> 周几（空串=未选）
const dayCounter = ref({})
const pickedList = computed(() => Object.entries(picked.value)
  .filter(([, d]) => d)
  .map(([id, weekday]) => ({ recipe: state.documents.find((r) => r.id === id), weekday }))
  .filter((x) => x.recipe))
const pickedRecipes = computed(() => pickedList.value.map((x) => x.recipe))
const preview = computed(() => aggregateShopping(pickedRecipes.value))
const pickedMissingCount = computed(() => pickedRecipes.value.filter((r) => !hasIngredients(r)).length)

function openPlanner() {
  picked.value = {}
  dayCounter.value = {}
  let i = 0
  for (const r of state.documents) {
    const weekday = i < 5 ? weekDays[i] : ''
    picked.value[r.id] = weekday
    if (weekday) dayCounter.value[weekday] = (dayCounter.value[weekday] || 0) + 1
    i += 1
  }
  showPlanner.value = true
}
function setDay(recipeId, weekday) {
  picked.value[recipeId] = weekday
}
const dayCount = (d) => pickedList.value.filter((x) => x.weekday === d).length
function generateMenus() {
  const byDay = new Map()
  for (const { recipe, weekday } of pickedList.value) {
    if (!byDay.has(weekday)) byDay.set(weekday, [])
    byDay.get(weekday).push(recipe)
  }
  for (const [weekday, recipes] of byDay) {
    const { items, missing } = aggregateShopping(recipes)
    add('policies', {
      weekday,
      title: `${weekday} · ${recipes.map((r) => r.name).join(' + ')}`,
      recipes: recipes.map((r) => ({ id: r.id, name: r.name })),
      expires: weekday,
      shopping: items,
      missing,
    })
  }
  showPlanner.value = false
  active.value = 'insurance'
}

function openCreate() { draft.value = Object.fromEntries(config.form.fields.map(([key, , value]) => [key, value || ''])); showForm.value = true }
function save() { add(config.form.collection, { ...draft.value }); showForm.value = false }
function readFile(event) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { draft.value.photo = reader.result }; reader.readAsDataURL(file) }
function markRenewed(doc) { update('documents', doc.id, { expires: `${new Date().getFullYear() + 10}-12-31`, renewed: true }) }
function navTo(id) { active.value = id; mobileOpen.value = false }
</script>
<template>
  <div class="app-shell">
    <aside class="sidebar" :class="{ open: mobileOpen }"><div class="brand"><span class="brand-mark"><FolderLock :size="19" /></span><div><strong>{{ config.brand }}</strong><small>{{ config.subtitle }}</small></div><button class="icon-btn close" @click="mobileOpen = false"><X :size="17" /></button></div><div class="family-chip"><span>林</span><div><b>林家家庭空间</b><small>4 位成员 · 私密存储</small></div><ChevronRight :size="15" /></div><nav><button v-for="item in config.nav" :key="item.id" :class="{ active: active === item.id }" @click="navTo(item.id)"><component :is="item.id === 'overview' ? LayoutDashboard : item.id === 'documents' ? Archive : item.id === 'history' ? CalendarClock : item.id === 'insurance' ? ShoppingCart : Award" :size="17" /><span>{{ item.label }}</span><i v-if="item.id === 'documents' && alerts.length">{{ alerts.length }}</i></button></nav><div class="sidebar-foot"><button><BookOpen :size="17" />使用指南</button><button><UserRound :size="17" />个人中心</button><button class="reset" @click="reset"><RotateCcw :size="15" />恢复演示数据</button></div></aside>
    <main class="main"><header class="topbar"><button class="icon-btn menu" @click="mobileOpen = true"><Menu :size="20" /></button><div><span class="eyebrow">家庭文件空间</span><h1>{{ activeNav.label }}</h1></div><div class="top-actions"><button class="icon-btn"><Bell :size="18" /><em v-if="alerts.length"></em></button><span class="avatar">林</span><b>Lin</b></div></header>
      <div class="page">
        <section class="intro"><div><span class="eyebrow">{{ active === 'overview' ? '星期三 · 2026年9月16日' : '数据随时保存在当前设备' }}</span><h2>{{ active === 'overview' ? config.heroTitle : activeNav.label }}</h2><p>{{ active === 'overview' ? config.heroCopy : '集中查看、编辑和追踪家庭资料。' }}</p></div><button v-if="active !== 'insurance'" class="primary" @click="openCreate"><Plus :size="16" />{{ config.createLabel || '新建档案' }}</button><button v-else class="primary" @click="openPlanner"><CalendarClock :size="16" />{{ config.secondaryAction }}</button></section>
        <section v-if="active === 'overview'" class="metric-grid"><article v-for="metric in metrics" :key="metric.label" class="metric"><span class="metric-icon" :class="metric.tone"><Archive v-if="metric.tone === 'green'" :size="17" /><CalendarClock v-else-if="metric.tone === 'peach'" :size="17" /><CircleAlert v-else-if="metric.tone === 'red'" :size="17" /><ShoppingCart v-else :size="17" /></span><div><small>{{ metric.label }}</small><strong>{{ metric.value }}</strong><em>{{ metric.tone === 'red' && metric.value ? '继续保持好味道' : metric.tone === 'peach' && metric.value ? '本月已有烹饪记录' : metric.tone === 'blue' ? `已采购 ${shopDone} / ${shopTotal} 项` : '较上月稳定' }}</em></div></article></section>
        <section v-if="active === 'overview'" class="content-grid"><article class="panel"><div class="panel-head"><div><span class="eyebrow">到期预警</span><h3>需要你留意的菜谱</h3></div><button class="text-btn" @click="navTo('documents')">查看全部 <ChevronRight :size="14" /></button></div><div class="alert-list"><div v-for="item in alerts.slice(0, 4)" :key="item.id" class="alert-row"><span class="alert-icon" :class="item.remaining < 0 ? 'danger' : 'warn'"><CircleAlert :size="16" /></span><div><b>{{ item.name }}</b><small>{{ item.holder}} · {{ item.category }}</small></div><span class="date-pill" :class="item.remaining < 0 ? 'danger' : 'warn'">{{ item.remaining < 0 ? `推荐日期过了 ${Math.abs(item.remaining)} 天` : `${item.remaining} 天后推荐再做` }}</span><button v-if="item.remaining <= 90" class="tiny-btn" @click="markRenewed(item)">今天做过</button></div><div v-if="!alerts.length" class="empty">近期没有需要安排的菜谱，保持得很好。</div></div></article><article class="panel score"><div class="panel-head"><div><span class="eyebrow">菜谱完整度</span><h3>家庭菜谱健康度</h3></div><TrendingUp :size="18" class="accent" /></div><div class="score-ring" :style="{ background: `radial-gradient(circle at center,#fff 61%,transparent 62%),conic-gradient(var(--green) 0 ${completion}%,#edf2e8 ${completion}%)` }"><strong>{{ completion }}<small>%</small></strong></div><p>食材和调料清单都填好的菜谱，安排菜单时才能自动汇总采购单。</p><div class="progress"><span :style="{ width: `${completion}%` }"></span></div><small class="muted">已完善 {{ filledCount }} / {{ state.documents.length }} 份菜谱</small></article></section>
        <section v-else-if="active === 'documents'" class="panel"><div class="toolbar"><div class="search"><Search :size="16" /><input v-model="query" :placeholder="`搜索${config.entityLabel}`" /></div><select><option>全部类别</option><option v-for="item in config.categories" :key="item">{{ item }}</option></select></div><div class="table-head"><span>{{ config.entityLabel }}</span><span>类别 / 难度</span><span>{{ config.dateLabel || '有效期' }}</span><span>食材 / 调料</span><span></span></div><div v-for="item in docs" :key="item.id" class="table-row"><div class="item-title"><span class="file-icon"><Archive :size="16" /></span><div><b>{{ item.name }}</b><small>{{ item.number || '未填写用时' }}</small></div></div><span><b>{{ item.category }}</b><small>{{ item.holder }}</small></span><span><b :class="{ dangerText: days(item.expires) < 0, warnText: days(item.expires) >= 0 && days(item.expires) <= 90 }">{{ item.issued }}</b><small>{{ days(item.expires) < 0 ? '推荐日期已过' : `${config.remainingPrefix || '剩余'} ${days(item.expires)} 天` }}</small></span><span><b :class="{ dangerText: !item.location }">{{ item.location || '⚠ 未填写食材清单' }}</b><small>调料：{{ item.copyLocation || '未填写' }}</small></span><button class="icon-btn"><ChevronRight :size="16" /></button></div><div v-if="!docs.length" class="empty">没有匹配的菜谱。</div></section>
        <section v-else-if="active === 'history'" class="panel"><div class="panel-head"><div><span class="eyebrow">{{ config.historyLabel }}</span><h3>{{ config.historyTitle || `${config.entityLabel}历史` }}</h3></div><span class="count-note">{{ borrowed.length }} 条待处理</span></div><div class="history-grid"><div v-for="entry in state.usages" :key="entry.id" class="history-card"><div class="history-date">{{ entry.date }}<span class="goodText">{{ entry.status }}</span></div><b>{{ state.documents.find(x => x.id === entry.documentId)?.name || config.entityLabel }}</b><p>{{ entry.purpose }} · 主厨 {{ entry.borrower }} · 评分 {{ entry.score }} 星</p><small>{{ entry.note || '无备注' }}</small></div></div></section>
        <section v-else-if="active === 'insurance'" class="menu-board">
          <div class="shop-summary panel">
            <div><span class="eyebrow">采购完成率</span><h3>{{ shopPercent }}% <small>（{{ shopDone }} / {{ shopTotal }} 项）</small></h3></div>
            <ShoppingCart :size="20" class="accent" />
            <div class="progress"><span :style="{ width: `${shopPercent}%` }"></span></div>
            <p>勾选菜单卡片中的食材即可更新进度；番茄 / 西红柿等同物异名已自动合并，重复食材只出现一次。</p>
            <div v-if="warnCount" class="warn-line"><CircleAlert :size="14" />{{ warnCount }} 道菜未填食材清单，未计入采购单，请补全后重新安排。</div>
          </div>
          <div class="panel-head" style="padding:0 2px"><div><span class="eyebrow">每周菜单</span><h3>已安排 {{ menus.length }} 天 · {{ state.policies.reduce((a, p) => a + (p.recipes?.length || 0), 0) }} 道菜</h3></div><button class="text-btn" @click="openPlanner">继续安排 <Plus :size="14" /></button></div>
          <div v-if="menus.length" class="menu-grid">
            <article v-for="plan in menus" :key="plan.id" class="panel menu-card">
              <div class="menu-card-head">
                <span class="day-pill">{{ plan.weekday }}</span>
                <b>{{ plan.recipes?.map(r => r.name).join(' + ') }}</b>
                <button class="icon-btn" @click="removePlan(plan)"><Trash2 :size="14" /></button>
              </div>
              <div v-if="plan.missing?.length" class="warn-line">
                <CircleAlert :size="14" />「{{ plan.missing.map(m => m.name).join('、') }}」未填食材清单，无法计入采购单
              </div>
              <div class="menu-progress">
                <small>采购 {{ plan.doneCount }}/{{ plan.total }} 项 · {{ plan.percent }}%</small>
                <div class="progress"><span :style="{ width: `${plan.percent}%` }"></span></div>
              </div>
              <ul v-if="plan.shopping?.length" class="shop-list">
                <li v-for="item in plan.shopping" :key="item.key">
                  <label class="check" :class="{ on: item.done }">
                    <input type="checkbox" :checked="item.done" @change="toggleItem(plan, item)" />
                    <span class="box"></span>
                    <span class="shop-name">{{ item.name }}</span>
                    <em v-if="item.sources.length > 1" class="merge-badge" :title="sourceTitle(item)">×{{ item.sources.length }} 道菜</em>
                    <small :title="sourceTitle(item)">{{ formatAmount(item) }}</small>
                  </label>
                </li>
              </ul>
              <div v-else class="empty mini">当天没有可汇总的食材，请先补全菜谱的食材清单。</div>
            </article>
          </div>
          <div v-else class="panel empty">还没有安排菜单，点击右上角「安排菜谱」选择本周想做的菜。</div>
        </section>
        <section v-else class="content-grid"><article class="panel"><div class="panel-head"><div><span class="eyebrow">成长记录</span><h3>成就徽章</h3></div><Award :size="18" class="accent" /></div><div class="badge-grid"><div v-for="(item, index) in config.achievements" :key="item" class="badge" :class="{ unlocked: index < Math.min(5, state.documents.length + 2) }"><span><Award :size="18" /></span><b>{{ item }}</b><small>{{ index < 5 ? '已解锁' : '待解锁' }}</small></div></div></article><article class="panel"><div class="panel-head"><div><span class="eyebrow">家庭榜单</span><h3>厨房管理达人</h3></div></div><div class="rank"><b>01</b><span class="rank-avatar">林</span><div><b>林小满</b><small>菜谱 {{ state.documents.length }} 份 · 烹饪 {{ state.usages.length }} 次</small></div><strong>98</strong></div><div class="rank"><b>02</b><span class="rank-avatar alt">周</span><div><b>周予安</b><small>菜谱 8 份 · 处理率 88%</small></div><strong>86</strong></div></article></section>
      </div>
    </main>
    <div v-if="showForm" class="modal-backdrop" @click.self="showForm = false"><form class="modal" @submit.prevent="save"><div class="modal-head"><div><span class="eyebrow">建立家庭档案</span><h3>{{ config.form.title }}</h3></div><button type="button" class="icon-btn" @click="showForm = false"><X :size="17" /></button></div><div class="form-grid"><label v-for="[key, label, placeholder, type] in config.form.fields" :key="key" :class="{ wide: key === 'notes' || key === 'location' || key === 'copyLocation' }">{{ label }}<input v-model="draft[key]" :type="type || 'text'" :placeholder="placeholder" /></label><label class="wide upload-field">照片或扫描件（可选）<input type="file" accept="image/*" @change="readFile" /><small>{{ draft.photo ? '已读取图片，可随菜谱保存' : '支持 JPG、PNG，内容仅保存在本机' }}</small></label></div><div class="modal-actions"><button type="button" class="secondary" @click="showForm = false">取消</button><button class="primary" type="submit"><FilePlus2 :size="16" />保存菜谱</button></div></form></div>

    <div v-if="showPlanner" class="modal-backdrop" @click.self="showPlanner = false">
      <div class="modal planner">
        <div class="modal-head"><div><span class="eyebrow">每周菜单</span><h3>安排菜谱 · 自动生成采购清单</h3></div><button type="button" class="icon-btn" @click="showPlanner = false"><X :size="17" /></button></div>
        <div class="planner-body">
          <div class="pick-list">
            <label v-for="r in state.documents" :key="r.id" class="pick-row" :class="{ off: !picked[r.id] }">
              <span class="pick-name"><b>{{ r.name }}</b><small>{{ r.category }} · {{ r.holder }}<i v-if="!hasIngredients(r)" class="warnInline">未填食材</i></small></span>
              <select v-model="picked[r.id]" @change="setDay(r.id, picked[r.id])">
                <option value="">不安排</option>
                <option v-for="d in weekDays" :key="d" :value="d">{{ d }}{{ dayCount(d) ? `（${dayCount(d)} 道）` : '' }}</option>
              </select>
            </label>
          </div>
          <div class="pick-preview">
            <div class="preview-head"><span class="eyebrow">合并后的采购清单预览</span><b>{{ preview.items.length }} 种食材</b></div>
            <ul v-if="preview.items.length" class="shop-list static">
              <li v-for="item in preview.items" :key="item.key">
                <span class="shop-name">{{ item.name }}</span>
                <em v-if="item.sources.length > 1" class="merge-badge" :title="sourceTitle(item)">×{{ item.sources.length }} 道菜</em>
                <small>{{ formatAmount(item) }}</small>
              </li>
            </ul>
            <div v-else class="empty mini">勾选菜谱并指定周几后，这里会显示合并去重的采购单。</div>
            <div v-if="pickedMissingCount" class="warn-line"><CircleAlert :size="14" />已选 {{ pickedMissingCount }} 道菜未填写食材清单，将不会出现在采购单中。</div>
          </div>
        </div>
        <div class="modal-actions">
          <span class="pick-foot-note">已选 {{ pickedList.length }} 道菜，按周几分成 {{ new Set(pickedList.map(x => x.weekday)).size }} 张菜单</span>
          <button type="button" class="secondary" @click="showPlanner = false">取消</button>
          <button class="primary" type="button" :disabled="!pickedList.length" @click="generateMenus"><FilePlus2 :size="16" />生成菜单与采购单</button>
        </div>
      </div>
    </div>
  </div>
</template>
