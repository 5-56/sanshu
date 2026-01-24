//! 智能代码审查交互工具模块
//!
//! 提供智能代码审查交互功能，支持预定义选项、自由文本输入和图片上传

pub mod mcp;
pub mod zhi_history;
pub mod commands;

// 重新导出主要类型和功能
pub use mcp::InteractionTool;
pub use zhi_history::{ZhiHistoryEntry, ZhiHistoryManager};
