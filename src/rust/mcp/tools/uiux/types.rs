// UI/UX Pro Max MCP 工具请求类型

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct UiuxSearchRequest {
    pub query: String,
    #[serde(default)]
    pub domain: Option<String>,
    #[serde(default)]
    pub max_results: Option<u32>,
    #[serde(default)]
    pub format: Option<String>, // text | json
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct UiuxStackRequest {
    pub query: String,
    pub stack: String,
    #[serde(default)]
    pub max_results: Option<u32>,
    #[serde(default)]
    pub format: Option<String>, // text | json
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct UiuxDesignSystemRequest {
    pub query: String,
    #[serde(default)]
    pub project_name: Option<String>,
    #[serde(default)]
    pub format: Option<String>, // ascii | markdown
    #[serde(default)]
    pub persist: Option<bool>,
    #[serde(default)]
    pub page: Option<String>,
    #[serde(default)]
    pub output_dir: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct UiuxSuggestRequest {
    pub text: String,
}
