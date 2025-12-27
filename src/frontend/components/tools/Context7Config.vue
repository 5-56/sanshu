<script setup lang="ts">
/**
 * Context7 文档查询工具配置组件
 * 包含：API Key 配置、连接测试
 */
import { invoke } from '@tauri-apps/api/core'
import { useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'
import ConfigSection from '../common/ConfigSection.vue'

const props = defineProps<{ active: boolean }>()
const message = useMessage()

// 配置状态
const config = ref({ api_key: '' })

// 测试状态
const testLoading = ref(false)
const testResult = ref<{ success: boolean; message: string; preview?: string } | null>(null)
const testLibrary = ref('spring-projects/spring-framework')
const testTopic = ref('core')

// 常用库数据
const popularLibs = [
  { label: 'Spring Framework', value: 'spring-projects/spring-framework', category: 'Java' },
  { label: 'Spring Boot', value: 'spring-projects/spring-boot', category: 'Java' },
  { label: 'MyBatis', value: 'mybatis/mybatis-3', category: 'Java' },
  { label: 'React', value: 'facebook/react', category: '前端' },
  { label: 'Vue.js', value: 'vuejs/vue', category: '前端' },
  { label: 'Next.js', value: 'vercel/next.js', category: '前端' },
  { label: 'FastAPI', value: 'tiangolo/fastapi', category: '后端' },
  { label: 'Tokio', value: 'tokio-rs/tokio', category: 'Rust' },
  { label: 'Tauri', value: 'tauri-apps/tauri', category: 'Rust' },
]

// --- 操作函数 ---

async function loadConfig() {
  try {
    const res = await invoke('get_context7_config') as { api_key?: string }
    config.value = { api_key: res.api_key || '' }
  } catch (err) {
    message.error(`加载配置失败: ${err}`)
  }
}

async function saveConfig() {
  try {
    await invoke('save_context7_config', { apiKey: config.value.api_key })
    message.success('Context7 配置已保存')
  } catch (err) {
    message.error(`保存失败: ${err}`)
  }
}

async function runTest() {
  testLoading.value = true
  testResult.value = null
  try {
    const res = await invoke('test_context7_connection', {
      library: testLibrary.value || null,
      topic: testTopic.value || null,
    }) as any
    
    testResult.value = res
    if (res.success) message.success('测试成功')
    else message.error(res.message)
    
  } catch (err) {
    testResult.value = { success: false, message: `System Error: ${err}` }
    message.error(`测试异常: ${err}`)
  } finally {
    testLoading.value = false
  }
}

// 组件挂载
onMounted(() => {
  if (props.active) loadConfig()
})

defineExpose({ saveConfig })
</script>

<template>
  <div class="context7-config">
    <n-scrollbar class="config-scrollbar">
      <n-space vertical size="large" class="config-content">
        <!-- 介绍提示 -->
        <n-alert type="info" :bordered="false" class="intro-alert">
          <template #icon><div class="i-carbon-information" /></template>
          Context7 提供最新的框架和库文档查询服务。
        </n-alert>

        <!-- 认证设置 -->
        <ConfigSection title="认证设置" description="配置 Context7 API Key 以获得更高的速率限制">
          <n-form-item label="API Key (可选)">
            <n-input
              v-model:value="config.api_key"
              type="password"
              show-password-on="click"
              placeholder="留空即使用免费模式"
              clearable
            />
            <template #feedback>
              <span class="form-feedback">
                免费模式有限制。获取 Key: 
                <a href="https://context7.com/dashboard" target="_blank" class="link">context7.com</a>
              </span>
            </template>
          </n-form-item>
          
          <div class="flex justify-end mt-3">
            <n-button type="primary" @click="saveConfig">
              <template #icon><div class="i-carbon-save" /></template>
              保存配置
            </n-button>
          </div>
        </ConfigSection>

        <!-- 连接测试 -->
        <ConfigSection title="连接与查询测试" description="测试是否能成功解析指定库的文档">
          <n-space vertical size="medium">
            <n-form-item label="测试目标库">
              <n-auto-complete
                v-model:value="testLibrary"
                :options="popularLibs.map(l => ({ label: l.label, value: l.value }))"
                placeholder="owner/repo (e.g. facebook/react)"
                clearable
              />
            </n-form-item>
            
            <n-form-item label="查询主题 (可选)">
              <n-input v-model:value="testTopic" placeholder="e.g. routing, state management" />
            </n-form-item>

            <div class="flex justify-end">
              <n-button 
                secondary 
                type="info" 
                :loading="testLoading" 
                :disabled="!testLibrary"
                @click="runTest"
              >
                <template #icon><div class="i-carbon-play" /></template>
                测试查询
              </n-button>
            </div>

            <!-- 测试结果 -->
            <transition name="fade">
              <div v-if="testResult" class="test-result" :class="testResult.success ? 'success' : 'error'">
                <div class="result-header">
                  <div :class="testResult.success ? 'i-carbon-checkmark-filled' : 'i-carbon-warning-filled'" />
                  {{ testResult.success ? '测试成功' : '测试失败' }}
                </div>
                <div class="result-message">{{ testResult.message }}</div>
                
                <div v-if="testResult.preview" class="result-preview">
                  <div class="preview-label">响应预览:</div>
                  <div class="preview-content">{{ testResult.preview }}</div>
                </div>
              </div>
            </transition>
          </n-space>
        </ConfigSection>

        <!-- 常用库参考 -->
        <div class="quick-libs">
          <div class="libs-label">常用库参考</div>
          <n-space size="small">
            <n-tag 
              v-for="lib in popularLibs" 
              :key="lib.value" 
              size="small" 
              class="lib-tag"
              :bordered="false"
              @click="testLibrary = lib.value"
            >
              {{ lib.label }}
            </n-tag>
          </n-space>
        </div>
      </n-space>
    </n-scrollbar>
  </div>
</template>

<style scoped>
.context7-config {
  height: 100%;
}

.config-scrollbar {
  max-height: 65vh;
}

.config-content {
  padding-right: 8px;
  padding-bottom: 16px;
}

/* 介绍提示 */
.intro-alert {
  border-radius: 8px;
}

/* 表单反馈 */
.form-feedback {
  font-size: 11px;
  color: var(--color-on-surface-muted, #9ca3af);
}

.link {
  color: #14b8a6;
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}

/* 测试结果 */
.test-result {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid;
}

.test-result.success {
  background: rgba(34, 197, 94, 0.08);
  border-color: rgba(34, 197, 94, 0.3);
}

.test-result.error {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.3);
}

:root.dark .test-result.success {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.4);
}

:root.dark .test-result.error {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
}

.result-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 4px;
}

.test-result.success .result-header {
  color: #22c55e;
}

.test-result.error .result-header {
  color: #ef4444;
}

.result-message {
  font-size: 12px;
  color: var(--color-on-surface-secondary, #6b7280);
}

:root.dark .result-message {
  color: #9ca3af;
}

.result-preview {
  margin-top: 12px;
}

.preview-label {
  font-size: 11px;
  color: var(--color-on-surface-muted, #9ca3af);
  margin-bottom: 6px;
}

.preview-content {
  padding: 10px;
  border-radius: 6px;
  font-size: 11px;
  font-family: ui-monospace, monospace;
  max-height: 150px;
  overflow-y: auto;
  background: var(--color-container, rgba(128, 128, 128, 0.08));
  border: 1px solid var(--color-border, rgba(128, 128, 128, 0.2));
}

:root.dark .preview-content {
  background: rgba(24, 24, 28, 0.8);
  border-color: rgba(255, 255, 255, 0.08);
}

/* 常用库 */
.quick-libs {
  padding-bottom: 8px;
}

.libs-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-on-surface-secondary, #6b7280);
  margin-bottom: 8px;
}

:root.dark .libs-label {
  color: #9ca3af;
}

.lib-tag {
  cursor: pointer;
  transition: all 0.2s ease;
}

.lib-tag:hover {
  background: rgba(20, 184, 166, 0.15);
}

/* 过渡动画 */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
