# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RightsGuard is a desktop application for automated copyright infringement appeals on Bilibili. Built with Next.js + Tauri architecture, it provides a modern desktop experience for managing copyright protection workflows.

## Development Commands

### Frontend (Next.js)
- `npm run dev` - Start Next.js development server
- `npm run build` - Build frontend static files (outputs to `out/` directory)
- `npm run lint` - Run ESLint for code quality checks

### Backend (Tauri)
- `npm run dev:tauri` - Run Tauri development mode (Rust backend + Next.js frontend)
- `npm run build:tauri` - Build complete desktop application (runs `npm run build` first, then builds Rust backend)

### Database
- `npm run db:push` - Push Prisma schema changes to database
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:reset` - Reset database

### Testing
Check the project for test scripts - none are currently defined in package.json.

## Memories
- 当你需要运行npm run build:tauri的时候，请告诉我，我会新开一个终端运行并告诉你结果。
- 更新完代码及时commit并push到github。

## Architecture

### Technology Stack
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui components
- **Backend**: Rust + Tauri framework for desktop functionality
- **Database**: SQLite with SQLx for async operations
- **Automation**: Playwright for browser automation
- **UI Library**: Extensive use of Radix UI components via shadcn/ui

### Key Directories
- `src/` - Next.js frontend source code
  - `app/` - Next.js 15 App Router pages
  - `components/` - React components (pages/ and ui/ subdirectories)
  - `hooks/` - Custom React hooks including Tauri integration
  - `lib/` - Utility libraries and Tauri API client
- `src-tauri/` - Rust backend source code
  - `src/main.rs` - Application entry point with system tray setup
  - `src/commands.rs` - Tauri command handlers for frontend-backend communication
  - `src/automation.rs` - Playwright-based browser automation logic
  - `src/database.rs` - SQLite database operations using SQLx
  - `src/models.rs` - Data models and type definitions

### Core Architecture Patterns

**Frontend-Backend Communication**: Uses Tauri's invoke system through a centralized API client (`src/lib/tauri-api.ts`). This client provides environment detection - full Tauri functionality in desktop mode, mock data for web development.

**Database Layer**: SQLite database with async operations via SQLx. All database operations are centralized in `src-tauri/src/database.rs`.

**Browser Automation**: Playwright integration for automating copyright appeal workflows. Automation state is managed globally using Arc<Mutex<AutomationStatus>>.

**System Integration**: 
- System tray functionality with show/hide/quit options
- File system access for document management (identity cards, copyright proofs)
- Cross-platform desktop application with window management

### Data Models
- **Profile**: Personal information for copyright appeals (name, phone, email, ID documents)
- **IpAsset**: Intellectual property assets (work name, type, ownership, rights period)
- **Case**: Copyright infringement cases (URLs, associated IP assets, status)
- **AutomationStatus**: Real-time status of automated appeal processes

## Development Workflow

### Environment Detection
The application automatically detects its running environment:
- **Desktop mode**: Full Tauri functionality with real database operations
- **Web mode**: Mock data and alerts for development/demo purposes

### Building for Production
1. Build frontend: `npm run build` (generates `out/` static files)
2. Build desktop app: `npm run build:tauri` (creates platform-specific executables)

### Key Integration Points
- Frontend communicates with backend exclusively through `tauriAPI` singleton
- All file operations go through Tauri's secure file system APIs
- Database operations are async and use proper error handling
- Automation processes run in background tasks with status monitoring

## Security Considerations
- Content Security Policy configured in `tauri.conf.json`
- File system access is controlled through Tauri's allowlist system
- Local SQLite database for privacy (no external data transmission)
- Secure file handling for sensitive documents (ID cards, copyright proofs)

---

# RightsGuard 开发进展报告

## 当前状态 (2025-08-14)

### ✅ 已完成的功能
1. **Git仓库清理** - 解决了108MB+大文件推送问题，成功推送到GitHub
2. **Tauri版本兼容性修复** - 成功回滚到工作的Tauri 2.0配置 (commit d4a808a)
3. **文件系统集成** - 实现了Tauri 2.0原生文件对话框API
   - 添加了 `tauri-plugin-dialog` 插件
   - 实现了 `select_file()` 和 `select_files()` 命令
   - 支持图片、PDF等多种文件格式过滤
4. **系统集成功能** - 实现了URL打开和消息提示
   - 添加了 `tauri-plugin-opener` 插件  
   - 实现了 `open_url()` 和 `show_message()` 命令
   - 使用回调模式确保API调用正确

### ✅ 已完成的功能 (续)
5. **编译错误修复** - Tauri 2.0插件API调用已全部修正
   - 修复了FilePath.to_string()方法调用
   - 文件对话框回调机制正常工作
   - 应用现在可以成功编译

### ✅ 已完成的功能 (续)
6. **数据序列化问题修复** - 解决前后端字段名不匹配导致的保存失败
   - 添加serde重命名属性实现camelCase到snake_case转换
   - 修复Profile、IpAsset、Case、AutomationStatus所有数据模型
   - 优化数据库路径和连接管理
   - 添加详细的调试日志输出

### 🔧 当前正在验证  
- **数据持久化测试** - 验证字段名修复是否解决保存问题
  - 已修复前端(camelCase)和后端(snake_case)字段名不匹配
  - 已优化数据库连接和错误处理  
  - 需要测试实际保存功能是否正常工作

### 🎯 下一步计划
1. **数据持久化验证** (优先级高)
   - 问题: 用户反馈数据在页面切换后丢失
   - 任务: 检查前后端API调用链路和数据库保存逻辑
2. **Bilibili自动化流程** (优先级中)  
   - 实现真正的Playwright浏览器自动化
   - 替换当前的placeholder实现
3. **表单验证和错误处理** (优先级低)
   - 身份证号、手机号、邮箱格式验证
   - 用户友好错误提示

### 🏗️ 架构改进
- **Tauri插件系统**: 从单体API迁移到Tauri 2.0插件架构
- **错误处理**: 统一的CommandError类型和错误传播
- **异步模式**: 正确使用回调而非async/await处理UI对话框

### 📝 技术债务
- 需要清理未使用的导入警告
- 需要添加更完善的错误日志
- 可考虑添加单元测试覆盖