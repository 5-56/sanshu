<script setup lang="ts">
/**
 * 配置区域组件
 * 提供统一的卡片式配置区块样式，支持主题自适应
 */
defineProps<{
  title?: string
  description?: string
  noCard?: boolean
}>()
</script>

<template>
  <div class="config-section">
    <!-- 标题区域 -->
    <div v-if="title || description" class="section-header">
      <h3 v-if="title" class="section-title">
        <slot name="icon" />
        {{ title }}
      </h3>
      <p v-if="description" class="section-description">
        {{ description }}
      </p>
    </div>

    <!-- 卡片内容 -->
    <div v-if="!noCard" class="section-card">
      <slot />
    </div>
    <div v-else class="section-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.config-section {
  margin-bottom: 4px;
}

/* 标题区域 */
.section-header {
  margin-bottom: 12px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-on-surface, #111827);
  margin: 0;
}

:root.dark .section-title {
  color: #e5e7eb;
}

.section-description {
  font-size: 12px;
  color: var(--color-on-surface-secondary, #6b7280);
  margin: 4px 0 0 0;
}

:root.dark .section-description {
  color: #9ca3af;
}

/* 卡片样式 */
.section-card {
  padding: 16px;
  border-radius: 10px;
  border: 1px solid var(--color-border, rgba(128, 128, 128, 0.2));
  background: var(--color-container, rgba(255, 255, 255, 0.6));
  backdrop-filter: blur(8px);
  transition: all 0.2s ease;
}

:root.dark .section-card {
  background: rgba(24, 24, 28, 0.7);
  border-color: rgba(255, 255, 255, 0.08);
}

.section-card:hover {
  border-color: rgba(20, 184, 166, 0.3);
}

:root.dark .section-card:hover {
  border-color: rgba(20, 184, 166, 0.4);
}

/* 无卡片内容 */
.section-content {
  padding: 0;
}
</style>
