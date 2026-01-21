<script setup lang="ts">
/**
 * 图标工坊 - 主组件
 * 提供图标搜索、预览、复制和保存功能
 */
import type { IconItem, IconSaveRequest } from '../../../types/icon'
import { invoke } from '@tauri-apps/api/core'
import { useMessage } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useIconSearch } from '../../../composables/useIconSearch'
import { DEFAULT_FILTER_OPTIONS } from '../../../types/icon'
import IconCard from './IconCard.vue'
import IconSaveModal from './IconSaveModal.vue'

interface Props {
  active?: boolean
  // 弹窗模式相关参数
  mode?: 'normal' | 'popup'
  initialQuery?: string
  initialStyle?: string
  initialSavePath?: string
  projectRoot?: string
  // 外部保存模式（由父组件接管保存流程）
  externalSave?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  active: false,
  mode: 'normal',
  initialQuery: '',
  initialStyle: 'all',
  initialSavePath: '',
  projectRoot: '',
  externalSave: false,
})

const emit = defineEmits<{
  // 外部保存请求（由父组件处理）
  save: [request: IconSaveRequest]
  // 选中图标变化通知（用于弹窗模式的编辑器）
  'selection-change': [icons: IconItem[]]
}>()

// 消息提示
const message = useMessage()

// 图标搜索 Hook
const {
  loading,
  error,
  searchParams,
  icons,
  total,
  hasMore,
  currentPage,
  selectedIds,
  selectedIcons,
  selectedCount,
  hasSelection,
  isAllSelected,
  showFilters,
  showSaveModal,
  config,
  search,
  loadMore,
  toggleSelect,
  toggleSelectAll,
  clearSelection,
  copyToClipboard,
  saveIcons,
  loadConfig,
} = useIconSearch()

// 本地状态
const searchInput = ref('')
const showCacheModal = ref(false)

// 计算属性
const hasResults = computed(() => icons.value.length > 0)
const isEmpty = computed(() => !loading.value && searchInput.value && !hasResults.value)
const showEmptyState = computed(() => !loading.value && !searchInput.value && !hasResults.value)

// 通知父组件选中图标变化
watch(selectedIcons, (value) => {
  emit('selection-change', value)
}, { immediate: true })

// 默认保存路径
const defaultSavePath = computed(() => {
  // 如果有初始保存路径（来自 CLI 参数），优先使用
  if (props.initialSavePath) {
    return props.initialSavePath
  }
  return config.value?.defaultSavePath || 'assets/icons'
})

// 执行搜索
async function handleSearch() {
  if (!searchInput.value.trim()) {
    message.warning('请输入搜索关键词')
    return
  }
  searchParams.query = searchInput.value.trim()
  await search()
}

// 回车搜索
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    handleSearch()
  }
}

// 复制图标
async function handleCopy(icon: IconItem) {
  const success = await copyToClipboard(icon)
  if (success) {
    message.success(`已复制 ${icon.name} 到剪贴板`)
  }
  else {
    message.error('复制失败')
  }
}

// 打开保存模态框
function openSaveModal() {
  if (!hasSelection.value) {
    message.warning('请先选择要保存的图标')
    return
  }
  showSaveModal.value = true
}

// 保存选中的图标
async function handleSave(request: IconSaveRequest) {
  // 外部保存模式：由父组件负责保存与后续流程
  if (props.externalSave) {
    showSaveModal.value = false
    emit('save', request)
    return
  }

  const result = await saveIcons(request)
  if (result) {
    message.success(`成功保存 ${result.successCount} 个图标`)
    showSaveModal.value = false
    clearSelection()

    // 如果是弹窗模式，保存成功后退出应用
    if (props.mode === 'popup') {
      try {
        // 构建响应数据
        const response = {
          saved_count: result.successCount,
          save_path: result.savePath,
          saved_names: result.items.filter((i: any) => i.success).map((i: any) => i.name),
          cancelled: false,
        }
        
        // 发送响应并退出
        await invoke('send_mcp_response', { response })
        await invoke('exit_app')
      } catch (e) {
        console.error('Failed to send response or exit:', e)
      }
    }
  }
}

// 加载更多
async function handleLoadMore() {
  if (loading.value || !hasMore.value)
    return
  await loadMore()
}

// 组件挂载时加载配置
onMounted(async () => {
  await loadConfig()

  // 如果是弹窗模式，初始化参数并自动搜索
  if (props.mode === 'popup') {
    if (props.initialQuery) {
      searchInput.value = props.initialQuery
      // 这里的 searchParams 是 reactive 对象，直接赋值即可
      searchParams.query = props.initialQuery
      
      if (props.initialStyle && props.initialStyle !== 'all') {
        // 简单的类型检查，确保它是合法的样式值
        if (['line', 'fill', 'flat', 'all'].includes(props.initialStyle)) {
          searchParams.style = props.initialStyle as 'line' | 'fill' | 'flat' | 'all'
        }
      }
      
      // 自动执行搜索
      await search()
    }
  }
})
</script>

<template>
  <div class="icon-workshop">
    <!-- 搜索区域 -->
    <div class="search-section">
      <!-- 搜索栏 -->
      <div class="search-bar">
        <n-input
          v-model:value="searchInput"
          placeholder="输入关键词搜索图标..."
          size="large"
          clearable
          class="search-input"
          @keydown="handleKeydown"
        >
          <template #prefix>
            <div class="i-carbon-search text-lg opacity-50" />
          </template>
        </n-input>
        <n-button
          type="primary"
          size="large"
          :loading="loading"
          @click="handleSearch"
        >
          <template #icon>
            <div class="i-carbon-search" />
          </template>
          搜索
        </n-button>
        <n-button
          quaternary
          size="large"
          :type="showFilters ? 'primary' : 'default'"
          @click="showFilters = !showFilters"
        >
          <template #icon>
            <div class="i-carbon-filter" />
          </template>
          筛选
        </n-button>
      </div>

      <!-- 筛选面板 -->
      <transition name="slide-down">
        <div v-if="showFilters" class="filter-panel">
          <div class="filter-group">
            <span class="filter-label">风格</span>
            <n-radio-group v-model:value="searchParams.style" size="small">
              <n-radio-button
                v-for="opt in DEFAULT_FILTER_OPTIONS.styles"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </n-radio-button>
            </n-radio-group>
          </div>
          <div class="filter-group">
            <span class="filter-label">填充</span>
            <n-radio-group v-model:value="searchParams.fills" size="small">
              <n-radio-button
                v-for="opt in DEFAULT_FILTER_OPTIONS.fills"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </n-radio-button>
            </n-radio-group>
          </div>
          <div class="filter-group">
            <span class="filter-label">排序</span>
            <n-radio-group v-model:value="searchParams.sortType" size="small">
              <n-radio-button
                v-for="opt in DEFAULT_FILTER_OPTIONS.sortTypes"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </n-radio-button>
            </n-radio-group>
          </div>
        </div>
      </transition>
    </div>

    <!-- 操作栏 -->
    <div v-if="hasResults" class="action-bar">
      <div class="action-left">
        <n-checkbox
          :checked="isAllSelected"
          :indeterminate="hasSelection && !isAllSelected"
          @update:checked="toggleSelectAll"
        >
          全选
        </n-checkbox>
        <span class="result-count">
          共 {{ total }} 个结果，当前第 {{ currentPage }} 页
        </span>
      </div>
      <div class="action-right">
        <n-button
          v-if="hasSelection"
          size="small"
          quaternary
          @click="clearSelection"
        >
          清空选择 ({{ selectedCount }})
        </n-button>
        <n-button
          type="primary"
          size="small"
          :disabled="!hasSelection"
          @click="openSaveModal"
        >
          <template #icon>
            <div class="i-carbon-download" />
          </template>
          保存选中 ({{ selectedCount }})
        </n-button>
      </div>
    </div>

    <!-- 图标网格 -->
    <div class="icon-grid-container">
      <!-- 加载骨架屏 -->
      <div v-if="loading && !hasResults" class="icon-grid">
        <div v-for="i in 20" :key="i" class="icon-skeleton">
          <div class="skeleton-icon" />
          <div class="skeleton-name" />
        </div>
      </div>

      <!-- 图标网格 -->
      <div v-else-if="hasResults" class="icon-grid">
        <IconCard
          v-for="icon in icons"
          :key="icon.id"
          :icon="icon"
          :selected="selectedIds.has(icon.id)"
          @toggle="toggleSelect(icon.id)"
          @copy="handleCopy(icon)"
        />
      </div>

      <!-- 空状态 - 无搜索结果 -->
      <div v-else-if="isEmpty" class="empty-state">
        <div class="i-carbon-search-locate text-5xl opacity-20 mb-4" />
        <p class="text-sm opacity-60">
          未找到相关图标，请尝试其他关键词
        </p>
      </div>

      <!-- 空状态 - 未搜索 -->
      <div v-else-if="showEmptyState" class="empty-state">
        <div class="i-carbon-image text-6xl opacity-15 mb-4" />
        <p class="text-base opacity-60 mb-2">
          搜索 Iconfont 图标库
        </p>
        <p class="text-sm opacity-40">
          输入关键词开始搜索图标
        </p>
      </div>
    </div>

    <!-- 加载更多 -->
    <div v-if="hasMore" class="load-more">
      <n-button
        :loading="loading"
        quaternary
        @click="handleLoadMore"
      >
        加载更多
      </n-button>
    </div>

    <!-- 错误提示 -->
    <n-alert
      v-if="error"
      type="error"
      closable
      class="mt-4"
    >
      {{ error }}
    </n-alert>

    <!-- 保存模态框 -->
    <IconSaveModal
      v-model:show="showSaveModal"
      :icons="selectedIcons"
      :default-path="defaultSavePath"
      @save="handleSave"
    />
  </div>
</template>

<style scoped>
.icon-workshop {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

/* ========== 搜索区域 ========== */
.search-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-bar {
  display: flex;
  gap: 8px;
  align-items: center;
}

.search-input {
  flex: 1;
}

.filter-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  background: var(--color-container, rgba(255, 255, 255, 0.8));
  border: 1px solid var(--color-border, rgba(128, 128, 128, 0.2));
}

:root.dark .filter-panel {
  background: rgba(24, 24, 28, 0.9);
  border-color: rgba(255, 255, 255, 0.08);
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 13px;
  color: var(--color-on-surface-secondary, #6b7280);
  min-width: 40px;
}

:root.dark .filter-label {
  color: #9ca3af;
}

/* ========== 操作栏 ========== */
.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--color-container, rgba(255, 255, 255, 0.6));
}

:root.dark .action-bar {
  background: rgba(24, 24, 28, 0.6);
}

.action-left, .action-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.result-count {
  font-size: 12px;
  color: var(--color-on-surface-secondary, #6b7280);
}

:root.dark .result-count {
  color: #9ca3af;
}

/* ========== 图标网格 ========== */
.icon-grid-container {
  flex: 1;
  overflow-y: auto;
  min-height: 300px;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
}

/* ========== 骨架屏 ========== */
.icon-skeleton {
  aspect-ratio: 1;
  padding: 12px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--color-container, rgba(255, 255, 255, 0.8));
  border: 1px solid var(--color-border, rgba(128, 128, 128, 0.2));
}

:root.dark .icon-skeleton {
  background: rgba(24, 24, 28, 0.9);
  border-color: rgba(255, 255, 255, 0.08);
}

.skeleton-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: linear-gradient(90deg, rgba(128,128,128,0.1) 25%, rgba(128,128,128,0.2) 50%, rgba(128,128,128,0.1) 75%);
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-name {
  width: 60%;
  height: 10px;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(128,128,128,0.1) 25%, rgba(128,128,128,0.2) 50%, rgba(128,128,128,0.1) 75%);
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s infinite;
}

@keyframes skeleton-pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ========== 空状态 ========== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: var(--color-on-surface-muted, #9ca3af);
}

/* ========== 加载更多 ========== */
.load-more {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

/* ========== 过渡动画 ========== */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
