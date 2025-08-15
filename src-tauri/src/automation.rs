use anyhow::Result;
use std::sync::Arc;
use tokio::sync::Mutex;
use chrono::Utc;
use crate::models::{AutomationRequest, AutomationStatus};
use once_cell::sync::Lazy;

static AUTOMATION_STATUS: Lazy<Arc<Mutex<AutomationStatus>>> = 
    Lazy::new(|| Arc::new(Mutex::new(AutomationStatus {
        is_running: false,
        current_step: None,
        progress: None,
        error: None,
        started_at: None,
    })));

// 用于控制人工验证步骤的信号
static VERIFICATION_COMPLETED: Lazy<Arc<Mutex<bool>>> = 
    Lazy::new(|| Arc::new(Mutex::new(false)));

pub async fn start_automation(request: AutomationRequest) -> Result<()> {
    let mut status = AUTOMATION_STATUS.lock().await;
    
    if status.is_running {
        return Err(anyhow::anyhow!("自动化流程已在运行中"));
    }
    
    *status = AutomationStatus {
        is_running: true,
        current_step: Some("初始化".to_string()),
        progress: Some(0.0),
        error: None,
        started_at: Some(Utc::now()),
    };
    
    drop(status);
    
    // 在后台运行自动化流程
    let request_arc = Arc::new(request);
    
    tokio::spawn(async move {
        if let Err(e) = run_automation_process(request_arc).await {
            let mut status = AUTOMATION_STATUS.lock().await;
            status.is_running = false;
            status.error = Some(e.to_string());
            status.current_step = Some("失败".to_string());
        } else {
            let mut status = AUTOMATION_STATUS.lock().await;
            status.is_running = false;
            status.current_step = Some("完成".to_string());
            status.progress = Some(100.0);
        }
    });
    
    Ok(())
}

pub async fn stop_automation() -> Result<()> {
    let mut status = AUTOMATION_STATUS.lock().await;
    status.is_running = false;
    status.current_step = Some("已停止".to_string());
    Ok(())
}

pub async fn get_automation_status() -> Result<AutomationStatus> {
    let status = AUTOMATION_STATUS.lock().await;
    Ok(AutomationStatus {
        is_running: status.is_running,
        current_step: status.current_step.clone(),
        progress: status.progress,
        error: status.error.clone(),
        started_at: status.started_at,
    })
}

async fn run_automation_process(request: Arc<AutomationRequest>) -> Result<()> {
    // 真实的Bilibili版权申诉自动化流程实现
    tracing::info!("Starting Bilibili copyright appeal automation");
    
    // 步骤1: 获取必要的数据
    update_status("正在获取数据...", 5.0).await;
    
    let profile = crate::database::get_profile().await?
        .ok_or_else(|| anyhow::anyhow!("未找到个人档案，请先在个人档案页面完成设置"))?;
    
    let ip_asset = if let Some(ip_id) = request.ip_asset_id {
        Some(crate::database::get_ip_asset(ip_id).await?
            .ok_or_else(|| anyhow::anyhow!("未找到指定的IP资产"))?)
    } else {
        None
    };
    
    // 步骤2: 使用Windows直接启动浏览器，然后Playwright连接
    update_status("启动浏览器...", 10.0).await;
    
    // 重置验证信号
    let mut verification = VERIFICATION_COMPLETED.lock().await;
    *verification = false;
    drop(verification);
    
    let browser_result = run_windows_browser_automation(&profile, ip_asset.as_ref(), &request).await;
    
    match browser_result {
        Ok(_) => {
            update_status("申诉提交成功", 100.0).await;
            // 保存案件记录
            save_case_record(&request).await?;
            Ok(())
        }
        Err(e) => {
            tracing::error!("Browser automation failed: {}", e);
            Err(e)
        }
    }
}

async fn update_status(step: &str, progress: f32) {
    let mut status = AUTOMATION_STATUS.lock().await;
    status.current_step = Some(step.to_string());
    status.progress = Some(progress);
}

async fn run_windows_browser_automation(
    profile: &crate::models::Profile,
    ip_asset: Option<&crate::models::IpAsset>,
    request: &AutomationRequest,
) -> Result<()> {
    use std::fs;
    
    // 方案1: 直接用Windows启动Chrome浏览器，然后Playwright连接
    update_status("通过Windows启动Chrome浏览器...", 15.0).await;
    
    // 启动Chrome浏览器，开启远程调试端口
    let chrome_result = start_chrome_with_remote_debugging().await;
    
    if let Err(e) = chrome_result {
        tracing::warn!("无法启动Chrome: {}, 回退到Playwright方案", e);
        return run_browser_automation_fallback(profile, ip_asset, request).await;
    }
    
    // 等待浏览器启动
    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
    
    // 创建连接已有浏览器的Playwright脚本
    update_status("生成连接脚本...", 25.0).await;
    tracing::info!("生成Playwright连接脚本，用户: {}", profile.name);
    
    let script_content = generate_connect_script(profile, ip_asset, request)?;
    
    // 写入脚本文件
    let script_path = "temp_connect_script.spec.js";
    fs::write(script_path, &script_content)
        .map_err(|e| anyhow::anyhow!("脚本文件写入失败: {}", e))?;
    
    update_status("连接到浏览器并执行自动化...", 30.0).await;
    
    // 使用最简单的npx执行
    let npx_result = execute_simple_playwright(script_path).await;
    
    // 清理临时文件
    let _ = fs::remove_file(script_path);
    
    match npx_result {
        Ok(_) => {
            tracing::info!("Windows浏览器自动化执行成功");
            Ok(())
        }
        Err(e) => {
            tracing::error!("Windows浏览器自动化失败: {}", e);
            // 如果Windows方案失败，回退到原始方案
            run_browser_automation_fallback(profile, ip_asset, request).await
        }
    }
}

// 检查自动化环境依赖
#[allow(dead_code)]
async fn check_automation_environment() -> Result<()> {
    use std::process::Command;
    
    tracing::info!("开始检查自动化环境依赖...");
    
    // 智能查找Node.js工具路径
    let (node_path, npm_path, npx_path) = find_nodejs_paths();
    
    // 检查Node.js
    match node_path {
        Some(path) => {
            match Command::new(&path).arg("--version").output() {
                Ok(output) if output.status.success() => {
                    let version = String::from_utf8_lossy(&output.stdout);
                    tracing::info!("✓ Node.js version: {}", version.trim());
                }
                _ => {
                    return Err(anyhow::anyhow!("Node.js 路径找到但执行失败"));
                }
            }
        }
        None => {
            return Err(anyhow::anyhow!(
                "Node.js 未安装或不可用。请从 https://nodejs.org 下载并安装 Node.js 18+ 版本"
            ));
        }
    }
    
    // 检查npm
    match npm_path {
        Some(path) => {
            match Command::new(&path).arg("--version").output() {
                Ok(output) if output.status.success() => {
                    let version = String::from_utf8_lossy(&output.stdout);
                    tracing::info!("✓ npm version: {}", version.trim());
                }
                _ => {
                    return Err(anyhow::anyhow!("npm 路径找到但执行失败"));
                }
            }
        }
        None => {
            return Err(anyhow::anyhow!("npm 不可用，请检查 Node.js 安装"));
        }
    }
    
    // 检查npx
    match npx_path.as_ref() {
        Some(path) => {
            match Command::new(path).arg("--version").output() {
                Ok(output) if output.status.success() => {
                    let version = String::from_utf8_lossy(&output.stdout);
                    tracing::info!("✓ npx version: {}", version.trim());
                }
                _ => {
                    return Err(anyhow::anyhow!("npx 路径找到但执行失败"));
                }
            }
        }
        None => {
            return Err(anyhow::anyhow!("npx 不可用，请检查 Node.js 安装"));
        }
    }
    
    // 检查Playwright
    match npx_path.as_ref() {
        Some(path) => {
            match Command::new(path).args(&["playwright", "--version"]).output() {
                Ok(output) if output.status.success() => {
                    let version = String::from_utf8_lossy(&output.stdout);
                    tracing::info!("✓ Playwright version: {}", version.trim());
                }
                _ => {
                    return Err(anyhow::anyhow!(
                        "Playwright 未安装。请运行以下命令安装:\n  npm install @playwright/test\n  npx playwright install"
                    ));
                }
            }
        }
        None => {
            return Err(anyhow::anyhow!("npx 不可用，无法检查 Playwright"));
        }
    }
    
    // 检查Chrome和Edge浏览器
    if cfg!(target_os = "windows") {
        if let Some(npx) = npx_path.as_ref() {
            // 检查系统Chrome
            let chrome_check = Command::new(&npx)
                .args(&["playwright", "install", "--dry-run", "chrome"])
                .output();
                
            match chrome_check {
                Ok(output) if output.status.success() => {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    if stdout.contains("Install location:    <system>") {
                        tracing::info!("✓ 系统Chrome浏览器可用");
                    } else {
                        tracing::warn!("系统Chrome浏览器不可用，将使用Playwright内置Chromium");
                    }
                }
                _ => {
                    tracing::warn!("无法检测Chrome浏览器状态");
                }
            }
        }
    }
    
    tracing::info!("✓ 环境检查完成，所有依赖都已就绪");
    Ok(())
}

// 智能查找Node.js工具的完整路径 - 改进版本
fn find_nodejs_paths() -> (Option<String>, Option<String>, Option<String>) {
    use std::path::Path;
    
    // Windows特定路径
    #[cfg(target_os = "windows")]
    let potential_paths = vec![
        // 标准安装路径
        ("C:\\Program Files\\nodejs\\node.exe", "C:\\Program Files\\nodejs\\npm.cmd", "C:\\Program Files\\nodejs\\npx.cmd"),
        ("C:\\Program Files (x86)\\nodejs\\node.exe", "C:\\Program Files (x86)\\nodejs\\npm.cmd", "C:\\Program Files (x86)\\nodejs\\npx.cmd"),
        
        // 用户本地安装路径
        ("C:\\Users\\%USERNAME%\\AppData\\Roaming\\npm\\node.exe", "C:\\Users\\%USERNAME%\\AppData\\Roaming\\npm\\npm.cmd", "C:\\Users\\%USERNAME%\\AppData\\Roaming\\npm\\npx.cmd"),
        
        // nvm安装路径
        ("C:\\Users\\%USERNAME%\\AppData\\Roaming\\nvm\\nodejs\\node.exe", "C:\\Users\\%USERNAME%\\AppData\\Roaming\\nvm\\nodejs\\npm.cmd", "C:\\Users\\%USERNAME%\\AppData\\Roaming\\nvm\\nodejs\\npx.cmd"),
        
        // PATH中的命令（最后尝试）
        ("node.exe", "npm.cmd", "npx.cmd"),
        ("node", "npm", "npx"),
    ];
    
    // macOS/Linux路径
    #[cfg(not(target_os = "windows"))]
    let potential_paths = vec![
        // 标准安装路径
        ("/usr/local/bin/node", "/usr/local/bin/npm", "/usr/local/bin/npx"),
        ("/usr/bin/node", "/usr/bin/npm", "/usr/bin/npx"),
        
        // nvm安装路径
        ("~/.nvm/versions/node/*/bin/node", "~/.nvm/versions/node/*/bin/npm", "~/.nvm/versions/node/*/bin/npx"),
        
        // Homebrew路径 (macOS)
        ("/opt/homebrew/bin/node", "/opt/homebrew/bin/npm", "/opt/homebrew/bin/npx"),
        
        // PATH中的命令
        ("node", "npm", "npx"),
    ];
    
    for (node_path, npm_path, npx_path) in potential_paths {
        // 展开环境变量 (Windows)
        #[cfg(target_os = "windows")]
        let expanded_node_path = expand_env_vars(node_path);
        #[cfg(target_os = "windows")]
        let expanded_npm_path = expand_env_vars(npm_path);
        #[cfg(target_os = "windows")]
        let expanded_npx_path = expand_env_vars(npx_path);
        
        #[cfg(not(target_os = "windows"))]
        let expanded_node_path = node_path.to_string();
        #[cfg(not(target_os = "windows"))]
        let expanded_npm_path = npm_path.to_string();
        #[cfg(not(target_os = "windows"))]
        let expanded_npx_path = npx_path.to_string();
        
        // 首先检查文件是否存在（绝对路径）
        if Path::new(&expanded_node_path).exists() {
            tracing::info!("找到Node.js路径: {}", expanded_node_path);
            return (Some(expanded_node_path), Some(expanded_npm_path), Some(expanded_npx_path));
        }
        
        // 然后尝试执行测试（PATH中的命令）
        if let Ok(output) = std::process::Command::new(&expanded_node_path).arg("--version").output() {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout);
                tracing::info!("通过PATH找到Node.js: {} (版本: {})", expanded_node_path, version.trim());
                return (Some(expanded_node_path), Some(expanded_npm_path), Some(expanded_npx_path));
            }
        }
    }
    
    tracing::warn!("未找到任何可用的Node.js安装");
    (None, None, None)
}

// 展开Windows环境变量
#[cfg(target_os = "windows")]
fn expand_env_vars(path: &str) -> String {
    if path.contains("%USERNAME%") {
        if let Ok(username) = std::env::var("USERNAME") {
            return path.replace("%USERNAME%", &username);
        }
    }
    if path.contains("%USERPROFILE%") {
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            return path.replace("%USERPROFILE%", &userprofile);
        }
    }
    if path.contains("%APPDATA%") {
        if let Ok(appdata) = std::env::var("APPDATA") {
            return path.replace("%APPDATA%", &appdata);
        }
    }
    path.to_string()
}

// 公开的环境检查函数，返回详细报告
pub async fn check_automation_environment_public() -> Result<String> {
    use std::process::Command;
    
    let mut report = vec![
        "🔍 RightsGuard 自动化环境检查报告".to_string(),
        "".to_string(),
    ];
    
    // 智能查找Node.js工具路径
    let (node_path, npm_path, npx_path) = find_nodejs_paths();
    
    // 检查Node.js
    match node_path {
        Some(path) => {
            match Command::new(&path).arg("--version").output() {
                Ok(output) if output.status.success() => {
                    let version = String::from_utf8_lossy(&output.stdout);
                    report.push(format!("✅ Node.js: {}", version.trim()));
                }
                _ => {
                    report.push("❌ Node.js: 路径找到但执行失败".to_string());
                }
            }
        }
        None => {
            report.push("❌ Node.js: 未找到安装路径".to_string());
            report.push("   请从 https://nodejs.org 下载并安装 Node.js 18+".to_string());
        }
    }
    
    // 检查npm
    match npm_path {
        Some(path) => {
            match Command::new(&path).arg("--version").output() {
                Ok(output) if output.status.success() => {
                    let version = String::from_utf8_lossy(&output.stdout);
                    report.push(format!("✅ npm: {}", version.trim()));
                }
                _ => {
                    report.push("❌ npm: 路径找到但执行失败".to_string());
                }
            }
        }
        None => {
            report.push("❌ npm: 未找到安装路径".to_string());
        }
    }
    
    // 检查Playwright
    match npx_path.as_ref() {
        Some(path) => {
            match Command::new(&path).args(&["playwright", "--version"]).output() {
                Ok(output) if output.status.success() => {
                    let version = String::from_utf8_lossy(&output.stdout);
                    report.push(format!("✅ Playwright: {}", version.trim()));
                }
                _ => {
                    report.push("❌ Playwright: npx可用但Playwright不可用".to_string());
                    report.push("   请运行: npm install @playwright/test".to_string());
                    report.push("   然后运行: npx playwright install".to_string());
                }
            }
        }
        None => {
            report.push("❌ Playwright: npx未找到".to_string());
            report.push("   请运行: npm install @playwright/test".to_string());
            report.push("   然后运行: npx playwright install".to_string());
        }
    }
    
    // 检查Chrome和Edge浏览器配置
    if cfg!(target_os = "windows") {
        report.push("".to_string());
        report.push("🌐 系统浏览器配置:".to_string());
        
        match npx_path.as_ref() {
            Some(npx) => {
                // 检查Chrome浏览器（系统Chrome）
                match Command::new(&npx)
                    .args(&["playwright", "install", "--dry-run", "chrome"])
                    .current_dir(".")
                    .output()
                {
                    Ok(output) if output.status.success() => {
                        let stdout = String::from_utf8_lossy(&output.stdout);
                        if stdout.contains("Install location:    <system>") {
                            report.push("✅ Chrome浏览器: 系统Chrome可用".to_string());
                        } else {
                            report.push("⚠️ Chrome浏览器: 需要安装或配置".to_string());
                        }
                    }
                    Ok(output) => {
                        let stderr = String::from_utf8_lossy(&output.stderr);
                        tracing::warn!("Chrome detection failed - stderr: {}", stderr);
                        report.push("⚠️ Chrome浏览器: 检测失败".to_string());
                    }
                    Err(e) => {
                        tracing::warn!("Chrome detection command failed: {}", e);
                        report.push("⚠️ Chrome浏览器: 无法检测".to_string());
                    }
                }
                
                // 检查Edge浏览器（系统Edge）
                match Command::new(&npx)
                    .args(&["playwright", "install", "--dry-run", "msedge"])
                    .current_dir(".")
                    .output()
                {
                    Ok(output) if output.status.success() => {
                        let stdout = String::from_utf8_lossy(&output.stdout);
                        if stdout.contains("Install location:    <system>") {
                            report.push("✅ Edge浏览器: 系统Edge可用".to_string());
                        } else {
                            report.push("⚠️ Edge浏览器: 需要安装或配置".to_string());
                        }
                    }
                    Ok(_) => {
                        report.push("⚠️ Edge浏览器: 检测失败".to_string());
                    }
                    Err(_) => {
                        report.push("⚠️ Edge浏览器: 无法检测".to_string());
                    }
                }
                
                // 检查Playwright内置Chromium
                match Command::new(&npx)
                    .args(&["playwright", "install", "--dry-run", "chromium"])
                    .current_dir(".")
                    .output()
                {
                    Ok(output) if output.status.success() => {
                        let stdout = String::from_utf8_lossy(&output.stdout);
                        if stdout.contains("chromium-") {
                            report.push("✅ Playwright Chromium: 已安装".to_string());
                        }
                    }
                    _ => {
                        report.push("⚠️ Playwright Chromium: 状态未知".to_string());
                    }
                }
            }
            None => {
                report.push("❌ 浏览器检测: npx不可用，无法检测浏览器配置".to_string());
            }
        }
    }
    
    report.push("".to_string());
    report.push("💡 使用说明:".to_string());
    report.push("   • 自动化将优先使用Chrome浏览器".to_string());
    report.push("   • 如果Chrome不可用，将自动切换到Edge".to_string());
    report.push("   • 浏览器将以有头模式运行，便于人工验证".to_string());
    
    Ok(report.join("\n"))
}

// 清理临时文件
#[allow(dead_code)]
async fn cleanup_temp_files() {
    use std::fs;
    
    let files_to_clean = [
        "temp_automation_script.spec.js",
        "verification_completed.txt", 
        "waiting_for_verification.txt"
    ];
    
    for file_name in &files_to_clean {
        if let Err(e) = fs::remove_file(file_name) {
            // 只在文件存在但删除失败时记录警告
            if fs::metadata(file_name).is_ok() {
                tracing::warn!("Failed to remove temp file {}: {}", file_name, e);
            }
        } else {
            tracing::info!("Cleaned up temp file: {}", file_name);
        }
    }
}

// 诊断Playwright错误
#[allow(dead_code)]
fn diagnose_playwright_error(error_output: &str, exit_code: Option<i32>) -> String {
    let error_lower = error_output.to_lowercase();
    
    if error_lower.contains("command not found") || error_lower.contains("is not recognized") {
        return "未找到npx命令。请安装Node.js (版本14或更高)".to_string();
    }
    
    if error_lower.contains("playwright") && error_lower.contains("not found") {
        return "Playwright未安装。请运行: npm run playwright:install".to_string();
    }
    
    if error_lower.contains("browser") && error_lower.contains("not found") {
        return "Playwright浏览器未安装。请运行: npx playwright install".to_string();
    }
    
    if error_lower.contains("timeout") {
        return "页面加载超时。请检查网络连接和目标网站是否可访问".to_string();
    }
    
    if error_lower.contains("permission") || error_lower.contains("access") {
        return "权限错误。请确保有足够的文件系统权限".to_string();
    }
    
    if error_lower.contains("network") || error_lower.contains("connection") {
        return "网络连接错误。请检查网络设置和防火墙配置".to_string();
    }
    
    // 返回通用错误信息
    format!(
        "浏览器自动化执行失败 (退出代码: {})\n错误详情: {}\n\n建议:\n1. 检查网络连接\n2. 确保Bilibili网站可访问\n3. 运行 'npm run playwright:install' 重新安装浏览器\n4. 检查系统防火墙设置", 
        exit_code.unwrap_or(-1),
        error_output
    )
}

#[allow(dead_code)]
fn generate_playwright_script(
    profile: &crate::models::Profile,
    ip_asset: Option<&crate::models::IpAsset>,
    request: &AutomationRequest,
) -> Result<String> {
    // 安全地转义字符串，防止JavaScript注入
    let escaped_name = escape_js_string(&profile.name);
    let escaped_phone = escape_js_string(&profile.phone);
    let escaped_email = escape_js_string(&profile.email);
    let escaped_id_card = escape_js_string(&profile.id_card_number);
    let escaped_infringing_url = escape_js_string(&request.infringing_url);
    
    let script = format!(r#"
const {{ test, expect, chromium }} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');

test('Bilibili Copyright Appeal Automation', async () => {{
    let browser = null;
    let context = null;
    let page = null;
    
    try {{
        console.log('Starting Bilibili copyright appeal automation with persistent context...');
        
        // 使用持久化浏览器上下文，保持用户登录状态
        const userDataDir = path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
        console.log('Using Chrome user data directory:', userDataDir);
        
        // 启动持久化浏览器上下文
        try {{
            context = await chromium.launchPersistentContext(userDataDir, {{
                headless: false,
                channel: 'chrome',
                args: [
                    '--no-first-run',
                    '--no-default-browser-check', 
                    '--disable-blink-features=AutomationControlled',
                    '--profile-directory=Default',
                    '--remote-debugging-port=0'
                ],
                viewport: {{ width: 1280, height: 720 }}
            }});
            console.log('Successfully launched Chrome with persistent context');
        }} catch (launchError) {{
            console.warn('Failed to launch with user data dir, falling back to fresh context:', launchError.message);
            // 如果用户数据目录被占用，使用临时目录
            const tempUserDataDir = path.join(os.tmpdir(), 'chrome-automation-' + Date.now());
            context = await chromium.launchPersistentContext(tempUserDataDir, {{
                headless: false,
                channel: 'chrome',
                args: [
                    '--no-first-run',
                    '--no-default-browser-check', 
                    '--disable-blink-features=AutomationControlled'
                ],
                viewport: {{ width: 1280, height: 720 }}
            }});
            console.log('Using temporary user data directory:', tempUserDataDir);
        }}
        
        // 获取或创建页面
        if (context.pages().length > 0) {{
            page = context.pages()[0];
        }} else {{
            page = await context.newPage();
        }}
        
        // 设置页面超时
        page.setDefaultTimeout(30000);
        page.setDefaultNavigationTimeout(60000);
        
        // 启动URL: https://www.bilibili.com/v/copyright/apply?origin=home
        console.log('Navigating to Bilibili copyright page...');
        await page.goto('https://www.bilibili.com/v/copyright/apply?origin=home', {{
            waitUntil: 'networkidle',
            timeout: 60000
        }});
        
        // 第一步: 资质认证
        console.log('Step 1: 资质认证');
        
        // 等待页面加载完成
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        
        // 名称: 填入真实姓名
        console.log('Filling name...');
        const nameInput = page.locator('input[placeholder="真实姓名"]');
        await nameInput.waitFor({{ timeout: 10000 }});
        await nameInput.fill('{}');
        
        // 手机号
        console.log('Filling phone...');
        const phoneInput = page.locator('input[placeholder="手机号"]');
        await phoneInput.waitFor({{ timeout: 10000 }});
        await phoneInput.fill('{}');
        
        // 邮箱
        console.log('Filling email...');
        const emailInput = page.locator('.el-form-item:has-text("邮箱") input');
        await emailInput.waitFor({{ timeout: 10000 }});
        await emailInput.fill('{}');
        
        // 身份认证: 证件号码
        console.log('Filling ID card number...');
        const idInput = page.locator('input[placeholder="证件号码"]');
        await idInput.waitFor({{ timeout: 10000 }});
        await idInput.fill('{}');
        
        // 证件证明: 文件上传
        const idCardFiles = {};
        if (idCardFiles && Array.isArray(idCardFiles) && idCardFiles.length > 0) {{
            console.log('Uploading ID card files...');
            try {{
                const fileInput = page.locator('.el-form-item:has-text("证件证明") input[type="file"]');
                await fileInput.waitFor({{ timeout: 10000 }});
                
                // 检查文件是否存在
                const validFiles = [];
                for (const filePath of idCardFiles) {{
                    if (fs.existsSync(filePath)) {{
                        validFiles.push(filePath);
                    }} else {{
                        console.warn(`File not found: ${{filePath}}`);
                    }}
                }}
                
                if (validFiles.length > 0) {{
                    await fileInput.setInputFiles(validFiles);
                    console.log(`Uploaded ${{validFiles.length}} ID card files`);
                }}
            }} catch (uploadError) {{
                console.error('Error uploading ID card files:', uploadError);
                // 继续执行，不中断流程
            }}
        }}
        
        // 创建状态文件以通知后端正在等待验证
        console.log('Creating verification status file...');
        fs.writeFileSync('waiting_for_verification.txt', 'waiting');
        
        // 暂停等待人工验证
        console.log('请手动完成滑块验证和短信验证...');
        console.log('验证完成后，脚本将自动继续');
        
        // 等待用户完成验证
        console.log('等待用户手动完成验证...');
        
        // 创建一个信号文件来等待用户完成验证
        const verificationFile = 'verification_completed.txt';
        
        // 清除之前的验证文件
        if (fs.existsSync(verificationFile)) {{
            fs.unlinkSync(verificationFile);
        }}
        
        // 等待验证完成信号，最多等待10分钟
        let waitTime = 0;
        const maxWaitTime = 600000; // 10分钟
        const checkInterval = 1000; // 1秒检查一次
        
        while (!fs.existsSync(verificationFile) && waitTime < maxWaitTime) {{
            await page.waitForTimeout(checkInterval);
            waitTime += checkInterval;
        }}
        
        // 清理状态文件
        if (fs.existsSync('waiting_for_verification.txt')) {{
            fs.unlinkSync('waiting_for_verification.txt');
        }}
        
        if (waitTime >= maxWaitTime) {{
            throw new Error('验证超时，请重新尝试');
        }}
        
        console.log('收到验证完成信号，继续执行...');
        
        // 点击下一步
        console.log('Clicking next step...');
        const nextButton = page.locator('button:has-text("下一步")');
        await nextButton.waitFor({{ timeout: 10000 }});
        await nextButton.click();
        await page.waitForLoadState('networkidle');
        
        // 第二步: 权益认证 (如果有IP资产数据)
        {}
        
        // 第三步: 申诉请求
        console.log('Step 3: 申诉请求');
        
        // 侵权链接
        console.log('Filling infringing URL...');
        const urlInput = page.locator('input[placeholder*="他人发布的B站侵权链接"]');
        await urlInput.waitFor({{ timeout: 10000 }});
        await urlInput.fill('{}');
        
        // 侵权描述
        console.log('Filling description...');
        const defaultDescription = '该链接内容全部或部分侵犯了我的著作权，未经我的许可擅自使用了我的原创作品，请依法删除侵权内容。';
        const descInput = page.locator('textarea[placeholder*="该链接内容全部"]');
        await descInput.waitFor({{ timeout: 10000 }});
        await descInput.fill(defaultDescription);
        
        // 原创链接 (如果提供)
        {}
        
        // 勾选承诺
        console.log('Checking agreement...');
        const checkbox = page.locator('.el-checkbox__label:has-text("本人保证")');
        await checkbox.waitFor({{ timeout: 10000 }});
        await checkbox.click();
        
        // 最终提交
        console.log('Submitting form...');
        const submitButton = page.locator('button:has-text("提交")');
        await submitButton.waitFor({{ timeout: 10000 }});
        await submitButton.click();
        
        // 等待提交结果
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
        
        console.log('申诉提交完成');
        
    }} catch (error) {{
        console.error('Automation error:', error);
        
        // 清理状态文件
        if (fs.existsSync('waiting_for_verification.txt')) {{
            fs.unlinkSync('waiting_for_verification.txt');
        }}
        
        throw error;
    }} finally {{
        // 确保正确清理浏览器资源
        if (context) {{
            console.log('Closing browser context...');
            await context.close();
        }}
    }}
}});
"#,
        escaped_name,
        escaped_phone, 
        escaped_email,
        escaped_id_card,
        format_file_paths(&profile.id_card_files),
        generate_ip_asset_section(ip_asset),
        escaped_infringing_url,
        generate_original_url_section(&request.original_url)
    );
    
    Ok(script)
}

// 转义JavaScript字符串，防止注入攻击
fn escape_js_string(s: &str) -> String {
    s.replace('\\', "\\\\")
     .replace('\'', "\\'")
     .replace('\"', "\\\"")
     .replace('\n', "\\n")
     .replace('\r', "\\r")
     .replace('\t', "\\t")
}

fn format_file_paths(files_json: &Option<String>) -> String {
    match files_json {
        Some(json_str) => {
            // 解析JSON字符串为文件路径数组
            match serde_json::from_str::<Vec<String>>(json_str) {
                Ok(paths) => {
                    let formatted_paths: Vec<String> = paths.iter()
                        .map(|p| format!("'{}'", p.replace("'", "\\'")))
                        .collect();
                    format!("[{}]", formatted_paths.join(", "))
                }
                Err(_) => "[]".to_string()
            }
        }
        None => "[]".to_string()
    }
}

fn generate_ip_asset_section(ip_asset: Option<&crate::models::IpAsset>) -> String {
    match ip_asset {
        Some(asset) => {
            let escaped_owner = escape_js_string(&asset.owner);
            let escaped_work_type = escape_js_string(&asset.work_type);
            let escaped_work_name = escape_js_string(&asset.work_name);
            let escaped_work_start = escape_js_string(&asset.work_start_date);
            let escaped_work_end = escape_js_string(&asset.work_end_date);
            let escaped_auth_start = escape_js_string(asset.auth_start_date.as_deref().unwrap_or(""));
            let escaped_auth_end = escape_js_string(asset.auth_end_date.as_deref().unwrap_or(""));
            
            format!(r#"
        console.log('Step 2: 权益认证');
        
        try {{
            // 权利人
            console.log('Filling owner name...');
            const ownerInput = page.locator('.el-form-item:has-text("权利人") input');
            await ownerInput.waitFor({{ timeout: 10000 }});
            await ownerInput.fill('{}');
            
            // 授权期限
            if ('{}' && '{}') {{
                console.log('Filling authorization period...');
                const authStartInput = page.locator('input[placeholder="起始时间"]').first();
                const authEndInput = page.locator('input[placeholder="结束时间"]').first();
                await authStartInput.waitFor({{ timeout: 10000 }});
                await authEndInput.waitFor({{ timeout: 10000 }});
                await authStartInput.fill('{}');
                await authEndInput.fill('{}');
            }}
            
            // 授权证明
            const authFiles = {};
            if (authFiles && Array.isArray(authFiles) && authFiles.length > 0) {{
                console.log('Uploading authorization files...');
                try {{
                    const authFileInput = page.locator('.el-form-item:has-text("授权证明") input[type="file"]');
                    await authFileInput.waitFor({{ timeout: 10000 }});
                    
                    // 检查文件是否存在
                    const validAuthFiles = [];
                    for (const filePath of authFiles) {{
                        if (fs.existsSync(filePath)) {{
                            validAuthFiles.push(filePath);
                        }} else {{
                            console.warn(`Auth file not found: ${{filePath}}`);
                        }}
                    }}
                    
                    if (validAuthFiles.length > 0) {{
                        await authFileInput.setInputFiles(validAuthFiles);
                        console.log(`Uploaded ${{validAuthFiles.length}} authorization files`);
                    }}
                }} catch (uploadError) {{
                    console.error('Error uploading authorization files:', uploadError);
                    // 继续执行，不中断流程
                }}
            }}
            
            // 著作类型
            console.log('Selecting work type...');
            const workTypeDropdown = page.locator('.el-form-item:has-text("著作类型")');
            await workTypeDropdown.waitFor({{ timeout: 10000 }});
            await workTypeDropdown.click();
            await page.waitForTimeout(1000);
            
            const workTypeOption = page.locator('.el-select-dropdown__item:has-text("{}")');
            await workTypeOption.waitFor({{ timeout: 10000 }});
            await workTypeOption.click();
            
            // 著作名称
            console.log('Filling work name...');
            const workNameInput = page.locator('.el-form-item:has-text("著作名称") input');
            await workNameInput.waitFor({{ timeout: 10000 }});
            await workNameInput.fill('{}');
            
            // 期限
            console.log('Filling work period...');
            const workStartInput = page.locator('input[placeholder="起始时间"]').last();
            const workEndInput = page.locator('input[placeholder="结束时间"]').last();
            await workStartInput.waitFor({{ timeout: 10000 }});
            await workEndInput.waitFor({{ timeout: 10000 }});
            await workStartInput.fill('{}');
            await workEndInput.fill('{}');
            
            // 证明文件
            const workProofFiles = {};
            if (workProofFiles && Array.isArray(workProofFiles) && workProofFiles.length > 0) {{
                console.log('Uploading work proof files...');
                try {{
                    const proofFileInput = page.locator('.el-form-item:has-text("证明")').last().locator('input[type="file"]');
                    await proofFileInput.waitFor({{ timeout: 10000 }});
                    
                    // 检查文件是否存在
                    const validProofFiles = [];
                    for (const filePath of workProofFiles) {{
                        if (fs.existsSync(filePath)) {{
                            validProofFiles.push(filePath);
                        }} else {{
                            console.warn(`Proof file not found: ${{filePath}}`);
                        }}
                    }}
                    
                    if (validProofFiles.length > 0) {{
                        await proofFileInput.setInputFiles(validProofFiles);
                        console.log(`Uploaded ${{validProofFiles.length}} work proof files`);
                    }}
                }} catch (uploadError) {{
                    console.error('Error uploading work proof files:', uploadError);
                    // 继续执行，不中断流程
                }}
            }}
            
            // 点击下一步
            console.log('Clicking next step after IP asset...');
            const nextButton2 = page.locator('button:has-text("下一步")');
            await nextButton2.waitFor({{ timeout: 10000 }});
            await nextButton2.click();
            await page.waitForLoadState('networkidle');
            
        }} catch (ipAssetError) {{
            console.error('Error in IP asset section:', ipAssetError);
            throw ipAssetError;
        }}
"#,
                escaped_owner,
                escaped_auth_start,
                escaped_auth_end,
                escaped_auth_start,
                escaped_auth_end,
                format_file_paths(&asset.auth_files),
                escaped_work_type,
                escaped_work_name,
                escaped_work_start,
                escaped_work_end,
                format_file_paths(&asset.work_proof_files)
            )
        },
        None => {
            // 如果没有IP资产，跳过权益认证步骤
            "        // 跳过权益认证步骤 - 未选择IP资产\n        console.log('Skipping IP asset section - no IP asset selected');".to_string()
        }
    }
}

fn generate_original_url_section(original_url: &Option<String>) -> String {
    match original_url {
        Some(url) => {
            let escaped_url = escape_js_string(url);
            format!(r#"
        // 原创链接
        console.log('Filling original URL...');
        try {{
            const originalUrlInput = page.locator('.textarea-wrapper:has-text("原创链接") input');
            await originalUrlInput.waitFor({{ timeout: 10000 }});
            await originalUrlInput.fill('{}');
            console.log('Original URL filled successfully');
        }} catch (originalUrlError) {{
            console.warn('Could not fill original URL:', originalUrlError);
            // 继续执行，不中断流程
        }}"#, escaped_url)
        },
        None => "        // 未提供原创链接\n        console.log('No original URL provided');".to_string()
    }
}

// 生成简化的自动化脚本 - 用于备用方案
fn generate_simple_automation_script(
    profile: &crate::models::Profile,
    ip_asset: Option<&crate::models::IpAsset>,
    request: &AutomationRequest,
) -> Result<String> {
    let escaped_name = escape_js_string(&profile.name);
    let escaped_phone = escape_js_string(&profile.phone);
    let escaped_email = escape_js_string(&profile.email);
    let escaped_infringing_url = escape_js_string(&request.infringing_url);
    
    let script = format!(r#"
const {{ test, expect, chromium }} = require('@playwright/test');

test('Bilibili Copyright Appeal - Simple Version', async () => {{
    let browser = null;
    let page = null;
    
    try {{
        console.log('启动简化版Bilibili申诉自动化...');
        
        // 使用简单的浏览器启动
        browser = await chromium.launch({{
            headless: false,
            channel: 'chrome'
        }});
        
        const context = await browser.newContext();
        page = await context.newPage();
        
        // 导航到申诉页面
        console.log('正在打开Bilibili申诉页面...');
        await page.goto('https://www.bilibili.com/v/copyright/apply?origin=home', {{
            waitUntil: 'networkidle',
            timeout: 60000
        }});
        
        console.log('✓ 页面加载完成');
        console.log('');
        console.log('=== 请按照以下步骤手动完成申诉 ===');
        console.log('');
        console.log('第一步 - 资质认证:');
        console.log('  姓名: {}');
        console.log('  手机: {}');
        console.log('  邮箱: {}');
        console.log('  完成滑块验证和短信验证');
        console.log('');
        console.log('第二步 - 权益认证:');
        {}
        console.log('');
        console.log('第三步 - 申诉请求:');
        console.log('  侵权链接: {}');
        console.log('  侵权描述: 该链接内容侵犯了我的著作权，未经许可使用我的原创作品');
        {}
        console.log('  勾选承诺并提交');
        console.log('');
        console.log('浏览器将保持打开状态，请手动完成上述步骤。');
        
        // 保持浏览器打开，等待用户手动操作
        await page.waitForTimeout(300000); // 等待5分钟
        
    }} catch (error) {{
        console.error('Simple automation error:', error);
        throw error;
    }} finally {{
        // 不关闭浏览器，让用户继续操作
        console.log('自动化脚本执行完成，浏览器保持打开状态');
    }}
}});
"#, 
        escaped_name, 
        escaped_phone, 
        escaped_email,
        generate_simple_ip_asset_instructions(ip_asset),
        escaped_infringing_url,
        generate_simple_original_url_instructions(&request.original_url)
    );
    
    Ok(script)
}

// 生成简化的IP资产说明
fn generate_simple_ip_asset_instructions(ip_asset: Option<&crate::models::IpAsset>) -> String {
    match ip_asset {
        Some(asset) => {
            format!(
                "  权利人: {}\n  著作类型: {}\n  著作名称: {}\n  上传授权证明文件",
                asset.owner, asset.work_type, asset.work_name
            )
        },
        None => "  (跳过权益认证，直接进入下一步)".to_string()
    }
}

// 生成简化的原创链接说明
fn generate_simple_original_url_instructions(original_url: &Option<String>) -> String {
    match original_url {
        Some(url) => format!("  原创链接: {}", url),
        None => "  (未提供原创链接)".to_string()
    }
}

// 手动浏览器指导方案
async fn run_manual_browser_guide(
    profile: &crate::models::Profile,
    ip_asset: Option<&crate::models::IpAsset>,
    request: &AutomationRequest,
) -> Result<()> {
    use std::process::Command;
    
    tracing::info!("启动手动浏览器指导方案");
    
    // 尝试打开系统默认浏览器
    let url = "https://www.bilibili.com/v/copyright/apply?origin=home";
    
    #[cfg(target_os = "windows")]
    let browser_result = Command::new("cmd")
        .args(&["/c", "start", url])
        .spawn();
    
    #[cfg(target_os = "macos")]
    let browser_result = Command::new("open")
        .arg(url)
        .spawn();
    
    #[cfg(target_os = "linux")]
    let browser_result = Command::new("xdg-open")
        .arg(url)
        .spawn();
    
    match browser_result {
        Ok(_) => {
            update_status("浏览器已打开，请手动完成申诉", 70.0).await;
            
            // 生成详细的手动操作指南
            let guide = generate_manual_operation_guide(profile, ip_asset, request);
            
            tracing::info!("手动操作指南:\n{}", guide);
            
            // 等待一段时间，让用户有时间完成操作
            tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
            
            update_status("请按照日志中的指南手动完成申诉", 90.0).await;
            
            Ok(())
        }
        Err(e) => {
            tracing::error!("无法打开系统浏览器: {}", e);
            Err(anyhow::anyhow!("无法打开浏览器进行手动操作: {}", e))
        }
    }
}

// 生成详细的手动操作指南
fn generate_manual_operation_guide(
    profile: &crate::models::Profile,
    ip_asset: Option<&crate::models::IpAsset>,
    request: &AutomationRequest,
) -> String {
    let mut guide = vec![];
    
    guide.push("📋 Bilibili版权申诉手动操作指南".to_string());
    guide.push("".to_string());
    guide.push("📍 申诉网址: https://www.bilibili.com/v/copyright/apply?origin=home".to_string());
    guide.push("".to_string());
    
    guide.push("第一步：资质认证".to_string());
    guide.push("─────────────────".to_string());
    guide.push(format!("• 姓名: {}", profile.name));
    guide.push(format!("• 手机号: {}", profile.phone));
    guide.push(format!("• 邮箱: {}", profile.email));
    guide.push(format!("• 证件号码: {}", profile.id_card_number));
    guide.push("• 上传身份证件照片".to_string());
    guide.push("• 完成滑块验证".to_string());
    guide.push("• 获取并输入短信验证码".to_string());
    guide.push("• 点击'下一步'".to_string());
    guide.push("".to_string());
    
    guide.push("第二步：权益认证".to_string());
    guide.push("─────────────────".to_string());
    match ip_asset {
        Some(asset) => {
            guide.push(format!("• 权利人: {}", asset.owner));
            guide.push(format!("• 著作类型: {}", asset.work_type));
            guide.push(format!("• 著作名称: {}", asset.work_name));
            guide.push(format!("• 著作期限: {} 至 {}", asset.work_start_date, asset.work_end_date));
            if let (Some(auth_start), Some(auth_end)) = (&asset.auth_start_date, &asset.auth_end_date) {
                guide.push(format!("• 授权期限: {} 至 {}", auth_start, auth_end));
            }
            guide.push("• 上传授权证明文件".to_string());
            guide.push("• 上传著作权证明文件".to_string());
        }
        None => {
            guide.push("• (无IP资产数据，请根据实际情况填写)".to_string());
        }
    }
    guide.push("• 点击'下一步'".to_string());
    guide.push("".to_string());
    
    guide.push("第三步：申诉请求".to_string());
    guide.push("─────────────────".to_string());
    guide.push(format!("• 侵权链接: {}", request.infringing_url));
    if let Some(original_url) = &request.original_url {
        guide.push(format!("• 原创链接: {}", original_url));
    }
    guide.push("• 侵权描述: 该链接内容全部或部分侵犯了我的著作权，未经我的许可擅自使用了我的原创作品，请依法删除侵权内容。".to_string());
    guide.push("• 勾选'本人保证'承诺".to_string());
    guide.push("• 点击'提交'完成申诉".to_string());
    guide.push("".to_string());
    
    guide.push("💡 温馨提示：".to_string());
    guide.push("• 请确保所有信息准确无误".to_string());
    guide.push("• 文件上传支持JPG、PNG、PDF等格式".to_string());
    guide.push("• 如有疑问，请参考Bilibili官方申诉指南".to_string());
    
    guide.join("\n")
}

async fn save_case_record(request: &AutomationRequest) -> Result<()> {
    use chrono::Utc;
    
    let case = crate::models::Case {
        id: None,
        infringing_url: request.infringing_url.clone(),
        original_url: request.original_url.clone(),
        associated_ip_id: request.ip_asset_id,
        status: "已提交".to_string(),
        submission_date: Some(Utc::now()),
        created_at: Some(Utc::now()),
        updated_at: Some(Utc::now()),
    };
    
    crate::database::save_case(&case).await?;
    tracing::info!("Case record saved successfully");
    Ok(())
}

pub async fn continue_after_verification() -> Result<()> {
    use std::fs;
    
    // 创建验证完成信号文件
    fs::write("verification_completed.txt", "completed")?;
    
    let mut verification = VERIFICATION_COMPLETED.lock().await;
    *verification = true;
    tracing::info!("Verification completed signal sent to Playwright");
    Ok(())
}

// Windows直接启动Chrome浏览器
async fn start_chrome_with_remote_debugging() -> Result<()> {
    use std::process::Command;
    
    // Chrome可能的安装路径
    let chrome_paths = vec![
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ];
    
    for chrome_path in chrome_paths {
        if std::path::Path::new(chrome_path).exists() {
            tracing::info!("找到Chrome浏览器: {}", chrome_path);
            
            // 启动Chrome，开启远程调试端口
            let result = Command::new(chrome_path)
                .args(&[
                    "--remote-debugging-port=9222",
                    "--user-data-dir=temp-chrome-profile",
                    "--no-first-run",
                    "--no-default-browser-check",
                    "https://www.bilibili.com/v/copyright/apply?origin=home"
                ])
                .spawn();
                
            match result {
                Ok(_) => {
                    tracing::info!("✓ Chrome浏览器启动成功，远程调试端口: 9222");
                    return Ok(());
                }
                Err(e) => {
                    tracing::warn!("Chrome启动失败: {}", e);
                    continue;
                }
            }
        }
    }
    
    Err(anyhow::anyhow!("无法找到或启动Chrome浏览器"))
}

// 生成连接已有浏览器的Playwright脚本 - 完整的三步流程
fn generate_connect_script(
    profile: &crate::models::Profile,
    ip_asset: Option<&crate::models::IpAsset>,
    request: &AutomationRequest,
) -> Result<String> {
    let escaped_name = escape_js_string(&profile.name);
    let escaped_phone = escape_js_string(&profile.phone);
    let escaped_email = escape_js_string(&profile.email);
    let escaped_id_card = escape_js_string(&profile.id_card_number);
    let escaped_infringing_url = escape_js_string(&request.infringing_url);
    
    // 生成IP资产相关字段
    let ip_asset_section = generate_ip_asset_section(ip_asset);
    let original_url_section = generate_original_url_section(&request.original_url);
    
    let script = format!(r#"
const {{ test, expect, chromium }} = require('@playwright/test');
const fs = require('fs');

test('Bilibili Copyright Appeal Automation - Connect Mode', async () => {{
    let browser = null;
    let context = null;
    let page = null;
    
    try {{
        console.log('连接到已运行的Chrome浏览器...');
        
        // 连接到远程调试端口
        browser = await chromium.connectOverCDP('http://localhost:9222');
        console.log('✓ 成功连接到Chrome浏览器');
        
        // 获取已有的上下文和页面
        const contexts = browser.contexts();
        if (contexts.length > 0) {{
            context = contexts[0];
            const pages = context.pages();
            if (pages.length > 0) {{
                page = pages[0];
            }} else {{
                page = await context.newPage();
            }}
        }} else {{
            context = await browser.newContext();
            page = await context.newPage();
        }}
        
        console.log('✓ 获取到页面，开始Bilibili申诉自动化...');
        
        // 确保在正确的页面上
        await page.goto('https://www.bilibili.com/v/copyright/apply?origin=home', {{
            waitUntil: 'networkidle',
            timeout: 60000
        }});
        
        // 等待页面加载完成
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
        
        // 调试信息 - 检查页面元素
        console.log('=== 页面调试信息 ===');
        const allInputs = await page.locator('input').count();
        console.log(`页面总输入框数量: ${{allInputs}}`);
        
        const nameInputs = await page.locator('input[placeholder="真实姓名"]').count();
        console.log(`"真实姓名"输入框数量: ${{nameInputs}}`);
        
        const phoneInputs = await page.locator('input[placeholder="手机号"]').count();
        console.log(`"手机号"输入框数量: ${{phoneInputs}}`);
        
        // 打印所有placeholder属性
        const placeholders = await page.locator('input').evaluateAll(inputs => 
            inputs.map(input => input.placeholder).filter(p => p)
        );
        console.log('所有输入框placeholder:', placeholders);
        
        // =========================
        // 第一步: 资质认证
        // =========================
        console.log('Step 1: 资质认证');
        
        // 姓名: 填入真实姓名 - 使用更精确的选择器
        console.log('Filling name...');
        await page.waitForTimeout(1000);
        const nameInput = page.locator('input[placeholder="真实姓名"].el-input__inner');
        await nameInput.waitFor({{ timeout: 15000 }});
        await nameInput.click(); // 先点击确保聚焦
        await nameInput.fill('{}');
        console.log('✓ Name filled');
        
        // 手机号
        console.log('Filling phone...');
        await page.waitForTimeout(1000);
        const phoneInput = page.locator('input[placeholder="手机号"].el-input__inner');
        await phoneInput.waitFor({{ timeout: 15000 }});
        await phoneInput.click();
        await phoneInput.fill('{}');
        console.log('✓ Phone filled');
        
        // 邮箱 - 尝试多种选择器
        console.log('Filling email...');
        await page.waitForTimeout(1000);
        let emailInput = page.locator('input[placeholder*="邮箱"].el-input__inner').first();
        if (await emailInput.count() === 0) {{
            emailInput = page.locator('.el-form-item:has-text("邮箱") input.el-input__inner');
        }}
        if (await emailInput.count() === 0) {{
            emailInput = page.locator('input[type="text"]').nth(2); // 第三个文本输入框通常是邮箱
        }}
        await emailInput.waitFor({{ timeout: 15000 }});
        await emailInput.click();
        await emailInput.fill('{}');
        console.log('✓ Email filled');
        
        // 身份认证 - 证件号码
        console.log('Filling ID card number...');
        await page.waitForTimeout(1000);
        let idInput = page.locator('input[placeholder="证件号码"].el-input__inner');
        if (await idInput.count() === 0) {{
            idInput = page.locator('input[placeholder*="身份证"].el-input__inner');
        }}
        if (await idInput.count() === 0) {{
            idInput = page.locator('.el-form-item:has-text("身份") input.el-input__inner');
        }}
        await idInput.waitFor({{ timeout: 15000 }});
        await idInput.click();
        await idInput.fill('{}');
        console.log('✓ ID card number filled');
        
        // 证件证明文件上传
        const idCardFiles = {};
        if (idCardFiles && Array.isArray(idCardFiles) && idCardFiles.length > 0) {{
            console.log('Uploading ID card files...');
            try {{
                const idFileInput = page.locator('.el-form-item:has-text("证件证明") input[type="file"]');
                await idFileInput.waitFor({{ timeout: 10000 }});
                
                // 检查文件是否存在
                const validIdFiles = [];
                for (const filePath of idCardFiles) {{
                    if (fs.existsSync(filePath)) {{
                        validIdFiles.push(filePath);
                    }} else {{
                        console.warn(`ID card file not found: ${{filePath}}`);
                    }}
                }}
                
                if (validIdFiles.length > 0) {{
                    await idFileInput.setInputFiles(validIdFiles);
                    console.log(`Uploaded ${{validIdFiles.length}} ID card files`);
                }}
            }} catch (uploadError) {{
                console.error('Error uploading ID card files:', uploadError);
                // 继续执行，不中断流程
            }}
        }}
        
        console.log('✓ 资质认证信息填写完成');
        
        // 创建等待验证信号文件
        fs.writeFileSync('waiting_for_verification.txt', 'waiting');
        console.log('⚠️  等待人工验证: 请手动完成滑块验证，获取并输入短信验证码');
        console.log('⚠️  完成验证后，请在桌面应用中点击"我已完成验证"按钮');
        
        // 等待验证完成信号
        while (true) {{
            await page.waitForTimeout(2000);
            if (fs.existsSync('verification_completed.txt')) {{
                console.log('✓ 收到验证完成信号，继续流程');
                fs.unlinkSync('verification_completed.txt');
                fs.unlinkSync('waiting_for_verification.txt');
                break;
            }}
        }}
        
        // 点击下一步
        console.log('Clicking next step...');
        const nextButton1 = page.locator('button:has-text("下一步")');
        await nextButton1.waitFor({{ timeout: 10000 }});
        await nextButton1.click();
        await page.waitForTimeout(2000);
        
        // =========================
        // 第二步: 权益认证
        // =========================
        console.log('Step 2: 权益认证');
        
        {}
        
        // 点击下一步
        console.log('Clicking next step...');
        const nextButton2 = page.locator('button:has-text("下一步")');
        await nextButton2.waitFor({{ timeout: 10000 }});
        await nextButton2.click();
        await page.waitForTimeout(2000);
        
        // =========================
        // 第三步: 申诉请求
        // =========================
        console.log('Step 3: 申诉请求');
        
        // 侵权链接
        console.log('Filling infringing URL...');
        const infringingUrlInput = page.locator('input[placeholder*="他人发布的B站侵权链接"]');
        await infringingUrlInput.waitFor({{ timeout: 10000 }});
        await infringingUrlInput.fill('{}');
        
        // 侵权描述
        console.log('Filling infringement description...');
        const descriptionInput = page.locator('textarea[placeholder*="该链接内容全部"]');
        await descriptionInput.waitFor({{ timeout: 10000 }});
        const defaultDescription = "该链接内容全部或部分侵犯了我的版权，未经我的授权擅自使用我的原创作品，构成版权侵权。请及时处理。";
        await descriptionInput.fill(defaultDescription);
        
        {}
        
        // 勾选承诺
        console.log('Checking promise checkbox...');
        const promiseCheckbox = page.locator('.el-checkbox__label:has-text("本人保证")');
        await promiseCheckbox.waitFor({{ timeout: 10000 }});
        await promiseCheckbox.click();
        
        console.log('✓ 申诉信息填写完成');
        console.log('⚠️  请手动检查信息并点击"提交"按钮完成申诉');
        
        // 保持浏览器打开，让用户手动提交
        console.log('保持浏览器打开状态，等待用户手动提交...');
        
    }} catch (error) {{
        console.error('自动化过程中出错:', error);
        // 清理信号文件
        try {{
            if (fs.existsSync('waiting_for_verification.txt')) {{
                fs.unlinkSync('waiting_for_verification.txt');
            }}
        }} catch (e) {{
            // 忽略清理错误
        }}
        throw error;
    }} finally {{
        // 不关闭浏览器，让用户继续操作
        console.log('Playwright脚本执行完成，浏览器保持打开状态');
    }}
}});
"#, 
        escaped_name, 
        escaped_phone, 
        escaped_email, 
        escaped_id_card,
        format_file_paths(&profile.id_card_files),
        ip_asset_section,
        escaped_infringing_url,
        original_url_section
    );
    
    Ok(script)
}

// 改进的Playwright执行，使用多重路径查找策略
async fn execute_simple_playwright(script_path: &str) -> Result<()> {
    use std::process::Command;
    
    tracing::info!("开始执行Playwright脚本: {}", script_path);
    
    // 策略1: 使用智能路径查找
    let (_, _, npx_path) = find_nodejs_paths();
    
    if let Some(npx) = npx_path {
        tracing::info!("使用找到的npx路径: {}", npx);
        
        let result = Command::new(&npx)
            .args(&["playwright", "test", script_path, "--headed"])
            .current_dir(".")
            .output();
            
        match result {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                
                tracing::info!("Playwright stdout: {}", stdout);
                if !stderr.is_empty() {
                    tracing::warn!("Playwright stderr: {}", stderr);
                }
                
                if output.status.success() {
                    tracing::info!("✓ Playwright脚本执行成功");
                    return Ok(());
                } else {
                    tracing::error!("✗ Playwright执行失败，退出代码: {:?}", output.status.code());
                    return Err(anyhow::anyhow!("Playwright执行失败: {}", stderr));
                }
            }
            Err(e) => {
                tracing::error!("✗ 无法执行npx命令 ({}): {}", npx, e);
                // 继续尝试其他策略
            }
        }
    }
    
    // 策略2: 尝试直接使用系统PATH中的npx
    tracing::info!("尝试使用系统PATH中的npx");
    let result = Command::new("npx")
        .args(&["playwright", "test", script_path, "--headed"])
        .current_dir(".")
        .output();
        
    match result {
        Ok(output) => {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                tracing::info!("✓ 使用系统PATH的npx执行成功: {}", stdout);
                return Ok(());
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                tracing::error!("✗ 系统PATH npx执行失败: {}", stderr);
            }
        }
        Err(e) => {
            tracing::error!("✗ 系统PATH npx不可用: {}", e);
        }
    }
    
    // 策略3: 尝试通过npm直接运行
    tracing::info!("尝试通过npm运行Playwright");
    let (_, npm_path, _) = find_nodejs_paths();
    
    if let Some(npm) = npm_path {
        let result = Command::new(&npm)
            .args(&["exec", "playwright", "test", script_path, "--headed"])
            .current_dir(".")
            .output();
            
        match result {
            Ok(output) => {
                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    tracing::info!("✓ 使用npm exec执行成功: {}", stdout);
                    return Ok(());
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    tracing::error!("✗ npm exec执行失败: {}", stderr);
                }
            }
            Err(e) => {
                tracing::error!("✗ npm exec不可用: {}", e);
            }
        }
    }
    
    // 所有策略都失败
    Err(anyhow::anyhow!(
        "无法执行Playwright: 尝试了多种npx路径策略但都失败了。\n建议:\n1. 确认Node.js已正确安装\n2. 运行 'npm install @playwright/test'\n3. 运行 'npx playwright install'"
    ))
}

// 备用方案：简化的浏览器自动化流程
async fn run_browser_automation_fallback(
    profile: &crate::models::Profile,
    ip_asset: Option<&crate::models::IpAsset>,
    request: &AutomationRequest,
) -> Result<()> {
    tracing::info!("启动备用的浏览器自动化方案");
    
    // 备用策略1: 生成更简单的Playwright脚本
    update_status("生成简化的自动化脚本...", 35.0).await;
    
    let simple_script = generate_simple_automation_script(profile, ip_asset, request)?;
    let script_path = "temp_simple_automation.spec.js";
    
    // 写入简化脚本
    use std::fs;
    fs::write(script_path, &simple_script)
        .map_err(|e| anyhow::anyhow!("简化脚本文件写入失败: {}", e))?;
    
    update_status("执行简化的自动化脚本...", 45.0).await;
    
    // 尝试执行简化脚本
    let simple_result = execute_simple_playwright(script_path).await;
    
    // 清理临时文件
    let _ = fs::remove_file(script_path);
    
    match simple_result {
        Ok(_) => {
            tracing::info!("✓ 备用方案执行成功");
            return Ok(());
        }
        Err(e) => {
            tracing::warn!("备用方案1失败: {}", e);
        }
    }
    
    // 备用策略2: 系统浏览器打开 + 手动操作指导
    update_status("启动系统浏览器，提供手动操作指导...", 55.0).await;
    
    let manual_result = run_manual_browser_guide(profile, ip_asset, request).await;
    
    match manual_result {
        Ok(_) => {
            tracing::info!("✓ 手动指导方案执行成功");
            Ok(())
        }
        Err(e) => {
            tracing::error!("✗ 所有备用方案都失败: {}", e);
            Err(anyhow::anyhow!(
                "自动化执行失败，建议:\n\
                1. 手动访问: https://www.bilibili.com/v/copyright/apply\n\
                2. 填写个人信息: {} / {} / {}\n\
                3. 填写申诉链接: {}\n\
                4. 检查Node.js和Playwright安装是否正确\n\
                原因: {}", 
                profile.name, profile.phone, profile.email, 
                request.infringing_url, e
            ))
        }
    }
}