# RightsGuard 桌面应用构建指南

## 项目概述

RightsGuard 是一个高效的B站版权侵权自动化申诉工具，采用 Next.js + Tauri 架构，提供现代化的桌面应用体验。

## 系统要求

- Rust 1.70+ 
- Node.js 18+
- npm 或 yarn

## 构建步骤

### 1. 安装依赖

```bash
# 安装前端依赖
npm install

# 安装Tauri CLI (如果尚未安装)
npm install -g @tauri-apps/cli
```

### 2. 构建前端静态文件

```bash
npm run build
```

这将生成 `out/` 目录，包含所有的静态文件。

### 3. 构建桌面应用

```bash
npm run build:tauri
```

这将：
- 构建Rust后端
- 打包前端静态文件
- 生成桌面应用可执行文件

### 4. 运行桌面应用

#### 开发模式
```bash
npm run dev:tauri
```

#### 生产模式
构建后的可执行文件位于：
- Windows: `src-tauri/target/release/rights-guard.exe`
- macOS: `src-tauri/target/release/RightsGuard`
- Linux: `src-tauri/target/release/rights-guard`

## 项目结构

```
├── src/                    # Next.js 前端源码
│   ├── app/               # 应用页面
│   ├── components/        # React 组件
│   ├── hooks/             # 自定义 Hooks
│   └── lib/               # 工具库和API客户端
├── src-tauri/             # Tauri 后端源码
│   ├── src/               # Rust 源码
│   │   ├── main.rs        # 应用入口
│   │   ├── models.rs      # 数据模型
│   │   ├── database.rs    # 数据库操作
│   │   ├── automation.rs  # 自动化逻辑
│   │   └── commands.rs    # Tauri 命令
│   ├── Cargo.toml         # Rust 依赖配置
│   └── tauri.conf.json    # Tauri 应用配置
├── out/                   # 构建输出的静态文件
└── package.json           # 项目配置
```

## 核心功能

### 1. 主界面 (Dashboard)
- 新建申诉任务
- 查看申诉案件列表
- 自动化流程状态监控

### 2. 个人档案配置
- 管理个人认证信息
- 上传身份证件照片
- 数据本地安全存储

### 3. IP资产库
- 管理知识产权作品
- 支持多种作品类型
- 完整的权益认证信息

### 4. 自动化申诉流程
- Playwright 驱动的浏览器自动化
- 人机协作的验证码处理
- 完整的表单填写和文件上传

## 技术架构

### 前端技术栈
- **Next.js 15** - React 全栈框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 现代CSS框架
- **shadcn/ui** - 高质量UI组件库
- **Tauri API** - 桌面应用接口

### 后端技术栈
- **Rust** - 系统级编程语言
- **Tauri** - 跨平台桌面应用框架
- **SQLite** - 轻量级本地数据库
- **Playwright** - 浏览器自动化
- **SQLx** - 异步数据库驱动

## 数据存储

应用使用本地SQLite数据库存储：
- 个人档案信息
- IP资产数据
- 申诉案件记录
- 自动化状态信息

所有数据都存储在用户本地，确保隐私安全。

## 安全特性

- 本地数据加密存储
- 文件系统访问权限控制
- 安全的浏览器自动化
- 用户输入验证

## 开发说明

### 环境检测

应用会自动检测运行环境：
- **Web环境**: 使用Mock数据进行演示
- **桌面环境**: 使用完整功能

### API调用

所有后端功能通过 `tauriAPI` 统一调用：
```typescript
import { tauriAPI } from '@/lib/tauri-api';

// 获取个人档案
const profile = await tauriAPI.getProfile();

// 保存个人档案
await tauriAPI.saveProfile(profileData);

// 启动自动化流程
await tauriAPI.startAutomation(infringingUrl, originalUrl, ipAssetId);
```

### 响应式设计

应用完全支持响应式设计：
- 桌面端：侧边栏导航 + 表格视图
- 移动端：抽屉式导航 + 卡片视图

## 故障排除

### 构建问题

1. **Rust环境问题**
   ```bash
   # 检查Rust版本
   rustc --version
   
   # 更新Rust
   rustup update
   ```

2. **依赖问题**
   ```bash
   # 清理并重新安装依赖
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Tauri构建问题**
   ```bash
   # 清理Tauri构建缓存
   cd src-tauri
   cargo clean
   ```

### 运行问题

1. **权限问题**
   - 确保应用有文件系统访问权限
   - 检查数据库文件权限

2. **自动化问题**
   - 确保系统安装了Chrome/Chromium
   - 检查网络连接

## 发布说明

### Windows发布
```bash
npm run build:tauri
# 可执行文件: src-tauri/target/release/rights-guard.exe
```

### macOS发布
```bash
npm run build:tauri
# 应用包: src-tauri/target/release/bundle/macos/RightsGuard.app
```

### Linux发布
```bash
npm run build:tauri
# 可执行文件: src-tauri/target/release/rights-guard
```

## 许可证

本项目采用 MIT 许可证。

## 支持

如有问题或建议，请通过以下方式联系：
- 提交 Issue
- 发送邮件到开发团队
- 查看项目文档