// 图标搜索 Hook
// 提供图标搜索、选择、保存等功能的响应式状态管理

import { invoke } from '@tauri-apps/api/core'
import { computed, reactive, ref } from 'vue'
import {
  type ClearCacheRequest,
  type ClearCacheResult,
  DEFAULT_SEARCH_PARAMS,
  type IconCacheStats,
  type IconConfig,
  type IconItem,
  type IconSaveRequest,
  type IconSaveResult,
  type IconSearchParams,
  type IconSearchResult,
} from '../types/icon'

// 后端返回的图标搜索结果（snake_case）
interface IconSearchResultRaw {
  icons: any[]
  total: number
  page: number
  page_size: number
  has_more: boolean
}

/**
 * 图标搜索 Hook
 * 提供完整的图标搜索、选择、保存功能
 */
export function useIconSearch() {
  // ============ 状态定义 ============

  /** 是否正在加载 */
  const loading = ref(false)

  /** 错误信息 */
  const error = ref<string | null>(null)

  /** 当前搜索参数 */
  const searchParams = reactive<IconSearchParams>({ ...DEFAULT_SEARCH_PARAMS })

  /** 搜索结果 */
  const searchResult = ref<IconSearchResult | null>(null)

  /** 选中的图标 ID 集合 */
  const selectedIds = ref<Set<number>>(new Set())

  /** 是否显示筛选面板 */
  const showFilters = ref(false)

  /** 是否显示保存模态框 */
  const showSaveModal = ref(false)

  /** 配置 */
  const config = ref<IconConfig | null>(null)

  // ============ 计算属性 ============

  /** 图标列表 */
  const icons = computed(() => searchResult.value?.icons ?? [])

  /** 总数量 */
  const total = computed(() => searchResult.value?.total ?? 0)

  /** 是否有下一页 */
  const hasMore = computed(() => searchResult.value?.hasMore ?? false)

  /** 当前页码 */
  const currentPage = computed(() => searchResult.value?.page ?? 1)

  /** 选中的图标列表 */
  const selectedIcons = computed(() =>
    icons.value.filter(icon => selectedIds.value.has(icon.id)),
  )

  /** 选中数量 */
  const selectedCount = computed(() => selectedIds.value.size)

  /** 是否有选中项 */
  const hasSelection = computed(() => selectedIds.value.size > 0)

  /** 是否全选 */
  const isAllSelected = computed(() => {
    if (icons.value.length === 0)
      return false
    return icons.value.every(icon => selectedIds.value.has(icon.id))
  })

  // ============ 方法定义 ============

  /**
   * 搜索图标
   */
  async function search(resetPage = true) {
    if (!searchParams.query.trim()) {
      error.value = '请输入搜索关键词'
      return
    }

    if (resetPage) {
      searchParams.page = 1
      selectedIds.value.clear()
    }

    loading.value = true
    error.value = null

    try {
      // 转换为后端期望的字段命名（snake_case）
      const request = {
        query: searchParams.query,
        style: searchParams.style,
        fills: searchParams.fills,
        sort_type: searchParams.sortType,
        page: searchParams.page,
        page_size: searchParams.pageSize,
        from_collection: searchParams.fromCollection,
      }

      const result = await invoke<IconSearchResultRaw>('search_icons', { request })

      // 转换响应字段（snake_case -> camelCase）
      const nextIcons = result.icons.map(transformIconFromBackend)
      if (!resetPage && searchResult.value) {
        // 追加分页结果，避免“加载更多”覆盖已有列表
        const mergedIcons = mergeIconLists(searchResult.value.icons, nextIcons)
        searchResult.value = {
          icons: mergedIcons,
          total: result.total,
          page: result.page,
          pageSize: result.page_size,
          hasMore: result.has_more,
        }
      }
      else {
        searchResult.value = {
          icons: nextIcons,
          total: result.total,
          page: result.page,
          pageSize: result.page_size,
          hasMore: result.has_more,
        }
      }
    }
    catch (e) {
      error.value = String(e)
      searchResult.value = null
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 转换后端返回的图标数据到前端格式
   */
  function transformIconFromBackend(icon: any): IconItem {
    return {
      id: icon.id,
      name: icon.name,
      fontClass: icon.font_class,
      unicode: icon.unicode,
      svgContent: icon.svg_content,
      previewUrl: icon.preview_url,
      author: icon.author,
      repositoryName: icon.repository_name,
      repositoryId: icon.repository_id,
      createdAt: icon.created_at,
    }
  }

  /**
   * 合并分页图标列表，保持原顺序并去重
   */
  function mergeIconLists(existing: IconItem[], incoming: IconItem[]) {
    const existingIds = new Set(existing.map(icon => icon.id))
    const merged = [...existing]
    for (const icon of incoming) {
      if (!existingIds.has(icon.id))
        merged.push(icon)
    }
    return merged
  }

  /**
   * 加载下一页
   */
  async function loadMore() {
    if (!hasMore.value || loading.value)
      return

    searchParams.page = currentPage.value + 1
    await search(false)
  }

  /**
   * 切换图标选中状态
   */
  function toggleSelect(iconId: number) {
    const newSet = new Set(selectedIds.value)
    if (newSet.has(iconId)) {
      newSet.delete(iconId)
    }
    else {
      newSet.add(iconId)
    }
    selectedIds.value = newSet
  }

  /**
   * 选中图标
   */
  function selectIcon(iconId: number) {
    const newSet = new Set(selectedIds.value)
    newSet.add(iconId)
    selectedIds.value = newSet
  }

  /**
   * 取消选中图标
   */
  function deselectIcon(iconId: number) {
    const newSet = new Set(selectedIds.value)
    newSet.delete(iconId)
    selectedIds.value = newSet
  }

  /**
   * 全选/取消全选
   */
  function toggleSelectAll() {
    if (isAllSelected.value) {
      // 取消全选
      selectedIds.value = new Set()
    }
    else {
      // 全选当前页
      selectedIds.value = new Set(icons.value.map(i => i.id))
    }
  }

  /**
   * 清空选择
   */
  function clearSelection() {
    selectedIds.value = new Set()
  }

  /**
   * 复制图标到剪贴板
   */
  async function copyToClipboard(icon: IconItem): Promise<boolean> {
    try {
      // 转换为后端格式
      const backendIcon = {
        id: icon.id,
        name: icon.name,
        font_class: icon.fontClass,
        unicode: icon.unicode,
        svg_content: icon.svgContent,
        preview_url: icon.previewUrl,
        author: icon.author,
        repository_name: icon.repositoryName,
        repository_id: icon.repositoryId,
        created_at: icon.createdAt,
      }
      await invoke('copy_icon_to_clipboard', { icon: backendIcon })
      return true
    }
    catch (e) {
      error.value = `复制失败: ${e}`
      return false
    }
  }

  /**
   * 保存图标到本地
   */
  async function saveIcons(request: IconSaveRequest): Promise<IconSaveResult | null> {
    loading.value = true
    error.value = null

    try {
      // 转换为后端格式
      const backendRequest = {
        icons: request.icons.map(icon => ({
          id: icon.id,
          name: icon.name,
          font_class: icon.fontClass,
          unicode: icon.unicode,
          svg_content: icon.svgContent,
          preview_url: icon.previewUrl,
          author: icon.author,
          repository_name: icon.repositoryName,
          repository_id: icon.repositoryId,
          created_at: icon.createdAt,
        })),
        save_path: request.savePath,
        format: request.format,
        png_size: request.pngSize,
      }

      const result = await invoke<any>('save_icons', { request: backendRequest })

      return {
        items: result.items.map((item: any) => ({
          id: item.id,
          name: item.name,
          success: item.success,
          savedPaths: item.saved_paths,
          error: item.error,
        })),
        successCount: result.success_count,
        failedCount: result.failed_count,
        savePath: result.save_path,
      }
    }
    catch (e) {
      error.value = `保存失败: ${e}`
      return null
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 获取缓存统计
   */
  async function getCacheStats(): Promise<IconCacheStats | null> {
    try {
      const result = await invoke<any>('get_icon_cache_stats')
      return {
        totalEntries: result.total_entries,
        validEntries: result.valid_entries,
        expiredEntries: result.expired_entries,
        cacheExpiryMinutes: result.cache_expiry_minutes,
        memoryUsageBytes: result.memory_usage_bytes,
      }
    }
    catch (e) {
      error.value = `获取缓存统计失败: ${e}`
      return null
    }
  }

  /**
   * 清空缓存
   */
  async function clearCache(request?: ClearCacheRequest): Promise<ClearCacheResult | null> {
    try {
      const result = await invoke<any>('clear_icon_cache', {
        request: { expired_only: request?.expiredOnly ?? false },
      })
      return {
        clearedCount: result.cleared_count,
        remainingCount: result.remaining_count,
      }
    }
    catch (e) {
      error.value = `清空缓存失败: ${e}`
      return null
    }
  }

  /**
   * 加载配置
   */
  async function loadConfig() {
    try {
      const result = await invoke<any>('get_icon_config')
      config.value = {
        defaultSavePath: result.default_save_path,
        defaultFormat: result.default_format,
        defaultPngSize: result.default_png_size,
        cacheExpiryMinutes: result.cache_expiry_minutes,
      }
    }
    catch (e) {
      console.error('加载图标配置失败:', e)
    }
  }

  /**
   * 保存配置
   */
  async function saveConfig(newConfig: IconConfig) {
    try {
      await invoke('set_icon_config', {
        config: {
          default_save_path: newConfig.defaultSavePath,
          default_format: newConfig.defaultFormat,
          default_png_size: newConfig.defaultPngSize,
          cache_expiry_minutes: newConfig.cacheExpiryMinutes,
        },
      })
      config.value = newConfig
    }
    catch (e) {
      error.value = `保存配置失败: ${e}`
    }
  }

  /**
   * 选择保存目录
   */
  async function selectSaveDirectory(): Promise<string | null> {
    try {
      const result = await invoke<string | null>('select_icon_save_directory', {
        defaultPath: config.value?.defaultSavePath,
      })
      return result
    }
    catch (e) {
      error.value = `选择目录失败: ${e}`
      return null
    }
  }

  /**
   * 重置搜索参数
   */
  function resetSearchParams() {
    Object.assign(searchParams, DEFAULT_SEARCH_PARAMS)
    searchResult.value = null
    selectedIds.value = new Set()
    error.value = null
  }

  // ============ 返回值 ============

  return {
    // 状态
    loading,
    error,
    searchParams,
    searchResult,
    selectedIds,
    showFilters,
    showSaveModal,
    config,

    // 计算属性
    icons,
    total,
    hasMore,
    currentPage,
    selectedIcons,
    selectedCount,
    hasSelection,
    isAllSelected,

    // 方法
    search,
    loadMore,
    toggleSelect,
    selectIcon,
    deselectIcon,
    toggleSelectAll,
    clearSelection,
    copyToClipboard,
    saveIcons,
    getCacheStats,
    clearCache,
    loadConfig,
    saveConfig,
    selectSaveDirectory,
    resetSearchParams,
  }
}
