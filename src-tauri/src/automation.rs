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
    
    // 步骤2: 启动Playwright浏览器
    update_status("启动浏览器...", 10.0).await;
    
    // 重置验证信号
    let mut verification = VERIFICATION_COMPLETED.lock().await;
    *verification = false;
    drop(verification);
    
    let browser_result = run_browser_automation(&profile, ip_asset.as_ref(), &request).await;
    
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

async fn run_browser_automation(
    profile: &crate::models::Profile,
    ip_asset: Option<&crate::models::IpAsset>,
    request: &AutomationRequest,
) -> Result<()> {
    use std::process::{Command, Stdio};
    use std::fs;
    
    // 首先验证Playwright环境
    update_status("检查自动化环境...", 10.0).await;
    
    if let Err(e) = check_automation_environment().await {
        return Err(e);
    }
    
    // 创建Playwright脚本
    update_status("正在生成自动化脚本...", 12.0).await;
    tracing::info!("生成Playwright脚本，使用个人档案: {}", profile.name);
    
    let script_content = match generate_playwright_script(profile, ip_asset, request) {
        Ok(script) => {
            tracing::info!("脚本生成成功，长度: {} 字符", script.len());
            script
        }
        Err(e) => {
            tracing::error!("脚本生成失败: {}", e);
            return Err(anyhow::anyhow!("脚本生成失败: {}", e));
        }
    };
    
    // 将脚本写入临时文件 (Playwright需要.spec.js后缀)
    let script_path = "temp_automation_script.spec.js";
    match fs::write(script_path, &script_content) {
        Ok(_) => {
            tracing::info!("脚本文件写入成功: {}", script_path);
        }
        Err(e) => {
            tracing::error!("脚本文件写入失败: {}", e);
            return Err(anyhow::anyhow!("脚本文件写入失败: {}", e));
        }
    }
    
    update_status("正在启动系统浏览器(Chrome)自动化...", 15.0).await;
    
    // 启动监控任务检查验证状态
    let monitoring_handle = tokio::spawn(async {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            
            if fs::metadata("waiting_for_verification.txt").is_ok() {
                update_status("等待人工验证 - 请完成滑块验证和短信验证", 30.0).await;
            }
            
            // 如果Playwright脚本已结束，停止监控
            if !fs::metadata("temp_automation_script.spec.js").is_ok() {
                break;
            }
        }
    });
    
    // 查找npx路径并执行Playwright脚本
    update_status("正在准备启动浏览器...", 17.0).await;
    
    let (_, _, npx_path) = find_nodejs_paths();
    let npx = npx_path.ok_or_else(|| anyhow::anyhow!("无法找到npx命令"))?;
    
    tracing::info!("准备执行Playwright命令: {} playwright test {} --headed --project=system-browser", npx, script_path);
    
    let mut cmd = Command::new(&npx);
    cmd.args(&["playwright", "test", script_path, "--headed", "--project=system-browser"])
        .current_dir(".")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    
    // 在Windows上设置环境变量以避免路径问题
    if cfg!(target_os = "windows") {
        cmd.env("PLAYWRIGHT_BROWSERS_PATH", "0");
    }
    
    update_status("正在启动浏览器并执行自动化...", 20.0).await;
    tracing::info!("开始执行Playwright命令...");
    
    let output = match cmd.output() {
        Ok(result) => {
            tracing::info!("Playwright命令执行完成，返回码: {:?}", result.status.code());
            Ok(result)
        }
        Err(e) => {
            tracing::error!("Playwright命令执行失败: {}", e);
            Err(e)
        }
    };
    
    // 停止监控任务
    monitoring_handle.abort();
    
    // 清理临时文件
    cleanup_temp_files().await;
    
    match output {
        Ok(result) => {
            let stdout_output = String::from_utf8_lossy(&result.stdout);
            let stderr_output = String::from_utf8_lossy(&result.stderr);
            
            tracing::info!("Playwright stdout: {}", stdout_output);
            if !stderr_output.is_empty() {
                tracing::warn!("Playwright stderr: {}", stderr_output);
            }
            
            if result.status.success() {
                tracing::info!("Chrome浏览器自动化执行成功");
                Ok(())
            } else {
                tracing::error!("Chrome浏览器执行失败，尝试使用Edge作为备选");
                
                // 尝试使用Edge作为备选浏览器
                let edge_output = Command::new(&npx)
                    .args(&[
                        "playwright", 
                        "test", 
                        script_path, 
                        "--headed", 
                        "--project=system-browser-edge"
                    ])
                    .current_dir(".")
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .output();
                    
                match edge_output {
                    Ok(edge_result) => {
                        let _edge_stdout = String::from_utf8_lossy(&edge_result.stdout);
                        let _edge_stderr = String::from_utf8_lossy(&edge_result.stderr);
                        
                        if edge_result.status.success() {
                            tracing::info!("Edge备选浏览器执行成功");
                            Ok(())
                        } else {
                            let error_details = if stderr_output.trim().is_empty() {
                                stdout_output.trim()
                            } else {
                                stderr_output.trim()
                            };
                            
                            // 提供更具体的错误诊断
                            let diagnostic_message = diagnose_playwright_error(error_details, result.status.code());
                            
                            tracing::error!("Chrome和Edge都执行失败: {}", diagnostic_message);
                            Err(anyhow::anyhow!("Chrome和Edge浏览器都执行失败: {}", diagnostic_message))
                        }
                    }
                    Err(e) => {
                        let error_details = if stderr_output.trim().is_empty() {
                            stdout_output.trim()
                        } else {
                            stderr_output.trim()
                        };
                        
                        let diagnostic_message = diagnose_playwright_error(error_details, result.status.code());
                        tracing::error!("无法启动备选浏览器: {}", e);
                        Err(anyhow::anyhow!("Chrome主浏览器失败且无法启动Edge备选: {}", diagnostic_message))
                    }
                }
            }
        }
        Err(e) => {
            cleanup_temp_files().await;
            let error_msg = format!(
                "无法启动Playwright命令: {}\n\n请检查:\n1. Node.js是否已安装 (需要版本14+)\n2. 是否在项目根目录运行\n3. 是否已运行 'npm install'\n4. 网络连接是否正常\n5. 防火墙是否阻止了浏览器启动",
                e
            );
            tracing::error!("Failed to execute Playwright command: {}", error_msg);
            update_status("浏览器启动失败", 0.0).await;
            Err(anyhow::anyhow!(error_msg))
        }
    }
}

// 检查自动化环境依赖
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

// 智能查找Node.js工具的完整路径
fn find_nodejs_paths() -> (Option<String>, Option<String>, Option<String>) {
    let potential_paths = vec![
        ("C:\\Program Files\\nodejs\\node.exe", "C:\\Program Files\\nodejs\\npm.cmd", "C:\\Program Files\\nodejs\\npx.cmd"),
        ("C:\\Program Files (x86)\\nodejs\\node.exe", "C:\\Program Files (x86)\\nodejs\\npm.cmd", "C:\\Program Files (x86)\\nodejs\\npx.cmd"),
        ("node", "npm", "npx"), // 备选：使用PATH中的命令
    ];
    
    for (node_path, npm_path, npx_path) in potential_paths {
        // 测试node命令
        if let Ok(output) = std::process::Command::new(node_path).arg("--version").output() {
            if output.status.success() {
                return (Some(node_path.to_string()), Some(npm_path.to_string()), Some(npx_path.to_string()));
            }
        }
    }
    
    (None, None, None)
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