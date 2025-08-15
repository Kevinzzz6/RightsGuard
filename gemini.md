RightsGuard-2 项目开发计划 (v2 - 2025-08-14 更新)
1. 项目总体评估 (已更新)
技术栈:

前端: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui

后端: Rust, Tauri 2.0 (已集成插件系统 tauri-plugin-dialog, tauri-plugin-opener)

数据库: SQLite (via rusqlite)

核心功能: 知识产权 (IP) 管理与自动化维权工具。

当前状态: 项目已度过初期环境配置和兼容性修复阶段。核心的后端框架搭建完毕，包括数据库连接、Tauri 插件集成和数据模型序列化问题已初步解决。当前的核心瓶颈是端到端的数据持久化流程尚未完全打通。 项目正从架构搭建转向核心功能验证阶段。

2. 待办事项清单 (To-Do List - 动态更新)
此清单已根据最新进展报告更新，并添加了状态标识，以便追踪。

状态说明:

✅ 已完成 (Done): 根据报告，此功能已实现并基本稳定。

🔧 正在验证/修复 (Verifying/Fixing): 功能已开发，但存在 bug 或需要完整测试。这是当前最高优先级。

🎯 下一步 (To Do): 计划中的下一个开发任务。

⏳ 待办 (Backlog): 重要但优先级较低的任务，可在核心功能稳定后进行。

P0: 核心功能闭环 (Critical Priority)
|

| 任务 ID | 任务名称 | 状态 | 描述 | 验收标准 | 关联文件 |
| P0-DB-02 | 端到端数据持久化验证 | 🔧 | 问题: 用户报告“数据在页面切换后丢失”。尽管序列化问题已修复，但数据未能成功保存或正确读取。任务: 彻底审查从前端表单提交到后端数据库保存，再到前端重新读取的完整链路。 | 1. 在 Profile 或 IpAsset 页面输入数据并保存，关闭再打开应用，数据依然存在。 2. 在一个页面保存数据后，切换到另一个页面再切回，数据不丢失。 3. 后端 update_* 和 add_* 命令能正确执行 SQL INSERT 或 UPDATE，并通过日志确认。 | ip-assets.tsx, profile.tsx, commands.rs, database.rs |
| P0-CMD-01 | 完成并统一后端命令 | 🔧 | 进展: CRUD 命令的骨架和序列化已完成。遗留问题: 命令的内部逻辑（特别是更新和查询逻辑）可能存在问题，导致数据持久化失败。需要对每个命令进行单元测试或手动测试。 | 1. 所有 get_*, add_*, update_*, delete_* 命令都能独立、正确地操作数据库。 2. 移除所有占位符 Ok("...") 实现。 3. *_old.rs 文件被彻底删除。 | commands.rs, database.rs |
| P0-UI-01 | 实现核心页面功能 (IP 资产管理) | 🔧 | 进展: 静态 UI 已完成。遗留问题: 与后端的交互逻辑因数据持久化问题受阻。 | 1. 页面加载时能正确从后端获取并显示 IP 资产列表。 2. 添加/编辑/删除资产后，前端列表能正确刷新并显示最新数据。 3. 所有异步操作都有明确的用户反馈（加载中、成功/失败提示）。 | ip-assets.tsx, tauri-api.ts |
| P0-DB-01 | 完善数据库模型与初始化 | ✅ | 进展: 根据报告，模型和序列化已修复，可认为表结构基本正确。 | 1. 应用启动时能自动创建或连接数据库。 2. 表结构与 models.rs 中的 #[serde(rename_all = "camelCase")] 属性兼容。 | database.rs, models.rs |

P1: 新功能开发与体验优化 (High Priority)
| 任务 ID | 任务名称 | 状态 | 描述 | 验收标准 | 关联文件 |
| P1-AUTO-02 | 实现 Bilibili 自动化维权流程 | 🎯 | 任务: 将 automation.rs 中的占位符逻辑替换为真正的浏览器自动化流程。使用 Playwright 或类似工具，实现登录、内容搜索、侵权链接识别和报告提交等功能。 | 1. 能在后台启动一个浏览器实例。 2. 根据用户配置，自动登录 Bilibili。 3. 实现一个完整的维权任务，并将执行状态（成功、失败、进行中）更新到数据库和前端 UI。 | automation.rs, settings.tsx |
| P1-ERR-02 | 实现前端表单验证 | 🎯 | 任务: 为关键输入字段（如身份证号、手机号、邮箱）添加格式验证。 | 1. 在用户输入时或提交表单时进行验证。 2. 对无效输入，在 UI 上给出清晰、友好的错误提示。 3. 使用 zod 或 react-hook-form 等库进行高效验证。 | profile.tsx, ip-assets.tsx, form.tsx |
| P1-ERR-01 | 全局错误处理与日志记录 | ⏳ | 进展: 已定义 CommandError。任务: 进一步完善。清理未使用的导入警告，并为关键操作（特别是数据库操作）添加更详细的文件日志。 | 1. Rust 端所有命令返回 Result<T, CommandError>。 2. 在 main.rs 中配置 log 和 tracing，将日志输出到 app.log 文件。 3. 前端对所有 invoke 调用都有 .catch 处理。 | main.rs, commands.rs, lib/utils.ts |
| P1-TEST-01 | 引入单元测试 | ⏳ | 任务: 为项目添加测试覆盖，以提高代码质量和长期可维护性。 | 1. 为 database.rs 中的数据库操作编写单元测试。 2. 为 commands.rs 中的核心命令逻辑编写集成测试。 | database.rs, commands.rs |

P2: 健壮性与部署 (Backlog)
| 任务 ID | 任务名称 | 状态 | 描述 | 验收标准 | 关联文件 |
| P2-DOC-01 | 编写项目文档 | ⏳ | README.md 内容不足。需要更新，详细说明项目功能、安装和开发步骤。 | 1. README.md 包含清晰的安装、开发和构建步骤。 | README.md |
| P2-BUILD-01 | 建立 CI/CD 流程 | ⏳ | 使用 GitHub Actions 创建自动化流程，用于在代码提交时运行测试、代码检查和构建。 | 1. 创建 .github/workflows/ci.yml 文件。 2. 该流程能在 push 到 main 分支时自动触发。 | .github/workflows/ci.yml |