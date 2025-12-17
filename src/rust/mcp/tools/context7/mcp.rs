use anyhow::Result;
use rmcp::model::{ErrorData as McpError, Tool, CallToolResult, Content};
use reqwest::header::AUTHORIZATION;
use reqwest::Client;
use serde_json::json;
use std::borrow::Cow;
use std::sync::Arc;
use std::time::Duration;

use super::types::{Context7Request, Context7Config, Context7Response};
use crate::log_debug;
use crate::log_important;

/// Context7 工具实现
pub struct Context7Tool;

impl Context7Tool {
    /// 查询框架文档
    pub async fn query_docs(request: Context7Request) -> Result<CallToolResult, McpError> {
        log_important!(info,
            "Context7 查询请求: library={}, topic={:?}, version={:?}, page={:?}",
            request.library, request.topic, request.version, request.page
        );

        // 读取配置
        let config = Self::get_config()
            .await
            .map_err(|e| McpError::internal_error(format!("获取 Context7 配置失败: {}", e), None))?;

        // 执行查询
        match Self::fetch_docs(&config, &request).await {
            Ok(result) => {
                log_important!(info, "Context7 查询成功");
                Ok(CallToolResult {
                    content: vec![Content::text(result)],
                    is_error: Some(false),
                    meta: None,
                    structured_content: None,
                })
            }
            Err(e) => {
                let error_msg = format!("Context7 查询失败: {}", e);
                log_important!(warn, "{}", error_msg);
                Ok(CallToolResult {
                    content: vec![Content::text(error_msg)],
                    is_error: Some(true),
                    meta: None,
                    structured_content: None,
                })
            }
        }
    }

    /// 获取工具定义
    pub fn get_tool_definition() -> Tool {
        let schema = json!({
            "type": "object",
            "properties": {
                "library": {
                    "type": "string",
                    "description": "库标识符，格式: owner/repo (例如: vercel/next.js, facebook/react, spring-projects/spring-framework)"
                },
                "topic": {
                    "type": "string",
                    "description": "查询主题 (可选，例如: routing, authentication, core)"
                },
                "version": {
                    "type": "string",
                    "description": "版本号 (可选，例如: v15.1.8)"
                },
                "page": {
                    "type": "integer",
                    "description": "分页页码 (可选，默认1，最大10)",
                    "minimum": 1,
                    "maximum": 10
                }
            },
            "required": ["library"]
        });

        if let serde_json::Value::Object(schema_map) = schema {
            Tool {
                name: Cow::Borrowed("context7"),
                description: Some(Cow::Borrowed("查询最新的框架和库文档，支持 Next.js、React、Vue、Spring 等主流框架。免费使用无需配置，配置 API Key 后可获得更高速率限制。")),
                input_schema: Arc::new(schema_map),
                annotations: None,
                icons: None,
                meta: None,
                output_schema: None,
                title: None,
            }
        } else {
            panic!("Schema creation failed");
        }
    }

    /// 获取配置
    async fn get_config() -> Result<Context7Config> {
        // 从配置文件中读取 Context7 配置
        let config = crate::config::load_standalone_config()
            .map_err(|e| anyhow::anyhow!("读取配置文件失败: {}", e))?;

        Ok(Context7Config {
            api_key: config.mcp_config.context7_api_key,
            base_url: "https://context7.com/api/v2".to_string(),
        })
    }

    /// 执行 HTTP 请求获取文档
    async fn fetch_docs(config: &Context7Config, request: &Context7Request) -> Result<String> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()?;

        // 构建 URL
        let url = format!("{}/docs/code/{}", config.base_url, request.library);
        log_debug!("Context7 请求 URL: {}", url);

        // 构建请求
        let mut req_builder = client.get(&url);

        // 添加 API Key (如果有)
        if let Some(api_key) = &config.api_key {
            req_builder = req_builder.header(AUTHORIZATION, format!("Bearer {}", api_key));
            log_debug!("使用 API Key 进行认证");
        } else {
            log_debug!("免费模式，无 API Key");
        }

        // 添加查询参数
        if let Some(topic) = &request.topic {
            req_builder = req_builder.query(&[("topic", topic)]);
        }
        if let Some(version) = &request.version {
            req_builder = req_builder.query(&[("version", version)]);
        }
        if let Some(page) = request.page {
            req_builder = req_builder.query(&[("page", page.to_string())]);
        }

        // 发送请求
        let response = req_builder.send().await?;
        let status = response.status();

        log_debug!("Context7 响应状态: {}", status);

        // 处理错误状态码
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "无法读取错误信息".to_string());
            return Err(anyhow::anyhow!(
                "API 请求失败 (状态码: {}): {}",
                status,
                Self::format_error_message(status.as_u16(), &error_text)
            ));
        }

        // 解析响应
        let response_text = response.text().await?;
        let api_response: Context7Response = serde_json::from_str(&response_text)
            .map_err(|e| anyhow::anyhow!("解析响应失败: {}", e))?;

        // 格式化输出
        Ok(Self::format_response(&api_response, request))
    }

    /// 格式化错误消息
    fn format_error_message(status_code: u16, error_text: &str) -> String {
        match status_code {
            401 => "API 密钥无效或已过期，请检查配置".to_string(),
            404 => format!("库不存在或拼写错误: {}", error_text),
            429 => "速率限制已达上限，建议配置 API Key 以获得更高速率限制".to_string(),
            500..=599 => format!("Context7 服务器错误: {}", error_text),
            _ => error_text.to_string(),
        }
    }

    /// 格式化响应为 Markdown
    fn format_response(response: &Context7Response, request: &Context7Request) -> String {
        let mut output = String::new();

        // 添加标题
        output.push_str(&format!("# {} 文档\n\n", request.library));

        if let Some(topic) = &request.topic {
            output.push_str(&format!("**主题**: {}\n", topic));
        }
        if let Some(version) = &request.version {
            output.push_str(&format!("**版本**: {}\n", version));
        }
        output.push_str("\n---\n\n");

        // 添加文档片段
        if response.snippets.is_empty() {
            output.push_str("未找到相关文档。请尝试调整查询参数。\n");
        } else {
            for (idx, snippet) in response.snippets.iter().enumerate() {
                if let Some(title) = &snippet.title {
                    output.push_str(&format!("## {}\n\n", title));
                } else {
                    output.push_str(&format!("## 片段 {}\n\n", idx + 1));
                }
                output.push_str(&snippet.content);
                output.push_str("\n\n");
            }
        }

        // 添加分页信息
        if let Some(pagination) = &response.pagination {
            output.push_str("---\n\n");
            output.push_str(&format!(
                "📄 第 {}/{} 页",
                pagination.current_page, pagination.total_pages
            ));
            if pagination.has_next {
                output.push_str(&format!(" | 使用 `page: {}` 查看下一页", pagination.current_page + 1));
            }
            output.push_str("\n");
        }

        // 添加来源信息
        output.push_str(&format!("\n🔗 来源: Context7 - {}\n", request.library));

        output
    }
}
