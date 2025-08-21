// src-tauri/src/automation.rs

use anyhow::{Result, Context};
use std::sync::Arc;
use tokio::sync::Mutex;
use chrono::Utc;
use crate::models::{AutomationRequest, AutomationStatus};
use once_cell::sync::Lazy;
use std::process::{Command, Child};
use reqwest;

static AUTOMATION_STATUS: Lazy<Arc<Mutex<AutomationStatus>>> = 
    Lazy::new(|| Arc::new(Mutex::new(AutomationStatus {
        is_running: false,
        current_step: None,
        progress: None,
        error: None,
        started_at: None,
    })));

static VERIFICATION_COMPLETED: Lazy<Arc<Mutex<bool>>> = 
    Lazy::new(|| Arc::new(Mutex::new(false)));

static CHROME_PROCESS: Lazy<Arc<Mutex<Option<Child>>>> = 
    Lazy::new(|| Arc::new(Mutex::new(None)));

// ==============================================
// Public API Functions
// ==============================================

pub async fn start_automation(request: AutomationRequest) -> Result<()> {
    let mut status = AUTOMATION_STATUS.lock().await;
    if status.is_running { return Err(anyhow::anyhow!("自动化流程已在运行中")); }
    
    *status = AutomationStatus {
        is_running: true,
        current_step: Some("初始化".to_string()),
        progress: Some(0.0),
        error: None,
        started_at: Some(Utc::now()),
    };
    drop(status);

    let request_arc = Arc::new(request);
    tokio::spawn(async move {
        let result = run_automation_process(request_arc).await;
        let mut status = AUTOMATION_STATUS.lock().await;
        
        match result {
            Ok(()) => {
                status.is_running = false;
                status.current_step = Some("完成".to_string());
                status.progress = Some(100.0);
                status.error = None;
            }
            Err(e) => {
                let error_message = format!("{:#}", e);
                tracing::error!("自动化流程失败: {}", error_message);
                status.is_running = false;
                status.current_step = Some("失败".to_string());
                status.error = Some(error_message);
            }
        }
        
        drop(status);
        
        let mut process_handle = CHROME_PROCESS.lock().await;
        if let Some(mut child) = process_handle.take() {
            if let Err(e) = child.kill() {
                tracing::warn!("清理Chrome进程时出错: {}", e);
            } else {
                tracing::info!("成功清理Chrome进程");
            }
        }
    });
    
    Ok(())
}

pub async fn stop_automation() -> Result<()> {
    let mut status = AUTOMATION_STATUS.lock().await;
    status.is_running = false;
    status.current_step = Some("已停止".to_string());
    
    let mut process_handle = CHROME_PROCESS.lock().await;
    if let Some(mut child) = process_handle.take() {
        if let Err(e) = child.kill() {
            tracing::error!("Failed to kill Chrome process on stop: {}", e);
        } else {
            tracing::info!("Successfully killed Chrome process on stop");
        }
    }
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

pub async fn check_automation_environment_public() -> Result<String> {
    Ok("环境检查功能就绪。".to_string())
}

pub async fn continue_after_verification() -> Result<()> {
    use std::fs;
    let project_root = std::env::current_dir()?.parent().ok_or_else(|| anyhow::anyhow!("Cannot find project root"))?.to_path_buf();
    let signal_file = project_root.join("verification_completed.txt");
    fs::write(signal_file, "completed")?;
    
    let mut verification = VERIFICATION_COMPLETED.lock().await;
    *verification = true;
    tracing::info!("Verification completed signal sent to Playwright");
    Ok(())
}

// ==============================================
// Core Automation Logic
// ==============================================

async fn run_automation_process(request: Arc<AutomationRequest>) -> Result<()> {
    update_status("获取数据...", 5.0).await;
    let profile = crate::database::get_profile().await?.ok_or_else(|| anyhow::anyhow!("未找到个人档案"))?;
    let ip_asset = if let Some(ip_id) = request.ip_asset_id {
        Some(crate::database::get_ip_asset(ip_id).await?.ok_or_else(|| anyhow::anyhow!("未找到指定的IP资产"))?)
    } else { None };

    update_status("启动浏览器...", 10.0).await;
    start_chrome_with_remote_debugging().await.context("启动带调试端口的Chrome失败")?;

    update_status("生成连接脚本...", 25.0).await;
    let project_root = std::env::current_dir()?.parent().ok_or_else(|| anyhow::anyhow!("Cannot find project root"))?.to_path_buf();
    let tests_dir = project_root.join("tests");
    std::fs::create_dir_all(&tests_dir).context("无法创建tests目录")?;

    let script_name = "temp_connect_script.spec.js";
    let script_path_buf = tests_dir.join(script_name);
    let script_path_for_command = format!("tests/{}", script_name);

    let script_content = generate_connect_script(&profile, ip_asset.as_ref(), &request, &project_root)?;
    std::fs::write(&script_path_buf, &script_content).context("写入Playwright脚本失败")?;
    tracing::info!("Playwright脚本已生成: {:?}", script_path_buf);
    
    update_status("正在启动Playwright测试...", 35.0).await;
    execute_playwright_test(&script_path_for_command, &project_root).await.context("执行Playwright脚本失败")?;
    
    update_status("Playwright脚本执行完成", 90.0).await;
    let _ = std::fs::remove_file(&script_path_buf);

    update_status("申诉提交成功", 100.0).await;
    save_case_record(&request).await?;
    Ok(())
}

async fn update_status(step: &str, progress: f32) {
    let mut status = AUTOMATION_STATUS.lock().await;
    status.current_step = Some(step.to_string());
    status.progress = Some(progress);
}

fn find_npx_executable() -> Result<String> {
    let possible_paths = vec![
        "C:\\Program Files\\nodejs\\npx.cmd",
        "C:\\Program Files (x86)\\nodejs\\npx.cmd",
    ];
    for path in possible_paths {
        if std::path::Path::new(path).exists() {
            return Ok(path.to_string());
        }
    }
    if Command::new("npx").arg("--version").output().is_ok() {
        return Ok("npx".to_string());
    }
    Err(anyhow::anyhow!("在常见路径中未找到npx.cmd。"))
}

async fn execute_playwright_test(script_path: &str, project_root: &std::path::Path) -> Result<()> {
    let npx_path = find_npx_executable()?;
    let mut cmd = Command::new(&npx_path);
    cmd.args(&["playwright", "test", script_path, "--timeout=300000"])
       .env("PLAYWRIGHT_BROWSERS_PATH", "0")
       .current_dir(project_root);
        
    let output = cmd.output()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    tracing::info!("Playwright stdout: {}", stdout);
    if !stderr.is_empty() {
        tracing::warn!("Playwright stderr: {}", stderr);
    }
    
    if !output.status.success() {
        return Err(anyhow::anyhow!("Playwright测试失败 (退出码: {:?}): {}", output.status.code(), stderr));
    }
    
    Ok(())
}

async fn start_chrome_with_remote_debugging() -> Result<()> {
    if check_chrome_debug_port().await {
        return Ok(());
    }

    if is_chrome_running().await {
        close_existing_chrome().await?;
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    }

    start_new_chrome_with_debugging().await
}

// ==============================================
// Script Generation (DEFINITIVE FIX HERE)
// ==============================================

fn generate_connect_script(
    profile: &crate::models::Profile,
    ip_asset: Option<&crate::models::IpAsset>,
    request: &AutomationRequest,
    project_root: &std::path::Path,
) -> Result<String> {
    let escaped_name = escape_js_string(&profile.name);
    let escaped_phone = escape_js_string(&profile.phone);
    let escaped_email = escape_js_string(&profile.email);
    let escaped_id_card = escape_js_string(&profile.id_card_number);
    let escaped_infringing_url = escape_js_string(&request.infringing_url);
    
    let waiting_file = escape_js_string(project_root.join("waiting_for_verification.txt").to_str().unwrap());
    let completed_file = escape_js_string(project_root.join("verification_completed.txt").to_str().unwrap());

    // --- CRITICAL FIX: Handle the conditional logic in Rust ---
    let ip_section = if let Some(asset) = ip_asset {
        // If an IP asset exists, generate the full JavaScript block for it.
        format!(r#"
        console.log('开始填写IP资产信息...');
        await page.locator('.el-form-item:has-text("权利人") input.el-input__inner').first().fill('{}');
        await page.locator('.el-form-item:has-text("著作类型") .el-select').first().click();
        await page.waitForTimeout(500);
        await page.locator('.el-select-dropdown__item:has-text("{}")').first().click();
        await page.locator('.el-form-item:has-text("著作名称") input.el-input__inner').first().fill('{}');
        console.log('✓ IP资产信息填写完成');
        await page.locator('button:has-text("下一步")').first().click();
        await page.waitForTimeout(2000);
"#,
            escape_js_string(&asset.owner),
            escape_js_string(&asset.work_type),
            escape_js_string(&asset.work_name)
        )
    } else { 
        // If no IP asset, this string will be empty.
        "".to_string() 
    };

    // The main script template now just inserts the pre-formatted ip_section block.
    Ok(format!(r#"
const {{ test, chromium }} = require('@playwright/test');
const fs = require('fs');

test('Bilibili Appeal - Connect Mode', async () => {{
    try {{
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222', {{ timeout: 15000 }});
        const context = browser.contexts()[0];
        const page = context.pages()[0] || await context.newPage();
        
        await page.goto('https://www.bilibili.com/v/copyright/apply?origin=home', {{ timeout: 60000, waitUntil: 'networkidle' }});

        await page.locator('input[placeholder="真实姓名"].el-input__inner').first().fill('{name}');
        await page.locator('input[placeholder="手机号"].el-input__inner').first().fill('{phone}');
        await page.locator('.el-form-item:has-text("邮箱") input.el-input__inner').first().fill('{email}');
        await page.locator('input[placeholder="证件号码"].el-input__inner').first().fill('{id_card}');
        
        fs.writeFileSync('{waiting_file}', 'waiting');
        while (true) {{
            if (fs.existsSync('{completed_file}')) {{
                fs.unlinkSync('{completed_file}');
                fs.unlinkSync('{waiting_file}');
                break;
            }}
            await page.waitForTimeout(1000);
        }}
        
        await page.locator('button:has-text("下一步")').first().click();
        await page.waitForTimeout(2000);
        
        // This is now safe, as ip_section is either a valid block of code or an empty string.
        {ip_section}
        
        await page.locator('input[placeholder*="他人发布的B站侵权链接"]').first().fill('{url}');
        await page.locator('textarea[placeholder*="该链接内容全部"]').first().fill('该链接内容侵犯了我的版权，要求立即删除。');
        await page.locator('.el-checkbox__label:has-text("本人保证")').first().click();
        
        await new Promise(() => {{}}); // Keep open indefinitely
    }} catch (error) {{
        console.error(error);
        throw error;
    }}
}});
"#, name = escaped_name, phone = escaped_phone, email = escaped_email, id_card = escaped_id_card, ip_section = ip_section, url = escaped_infringing_url, waiting_file=waiting_file, completed_file=completed_file))
}

// ==============================================
// Helper Functions
// ==============================================

async fn check_chrome_debug_port() -> bool {
    if tokio::net::TcpStream::connect("127.0.0.1:9222").await.is_ok() {
        if let Ok(true) = check_chrome_debug_api().await {
            return true;
        }
    }
    false
}

async fn check_chrome_debug_api() -> Result<bool> {
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(5)).build()?;
    Ok(client.get("http://127.0.0.1:9222/json/version").send().await.map_or(false, |res| res.status().is_success()))
}

async fn is_chrome_running() -> bool {
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = Command::new("tasklist").args(&["/FI", "IMAGENAME eq chrome.exe"]).output() {
            String::from_utf8_lossy(&output.stdout).contains("chrome.exe")
        } else { false }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Command::new("pgrep").arg("chrome").status().await.map_or(false, |s| s.success())
    }
}

fn get_chrome_user_data_dir() -> Result<String> {
    let home_dir = dirs::home_dir().ok_or_else(|| anyhow::anyhow!("无法获取用户主目录"))?;
    let user_data_dir = home_dir.join("AppData\\Local\\RightsGuard\\ChromeProfile");
    std::fs::create_dir_all(&user_data_dir).ok();
    Ok(user_data_dir.to_str().unwrap().to_string())
}

async fn close_existing_chrome() -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        Command::new("taskkill").args(&["/F", "/IM", "chrome.exe"]).output().context("无法强制关闭Chrome进程")?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = Command::new("pkill").args(&["-KILL", "chrome"]).output();
    }
    Ok(())
}

async fn start_new_chrome_with_debugging() -> Result<()> {
    let mut process_handle = CHROME_PROCESS.lock().await;
    if let Some(mut child) = process_handle.take() {
        let _ = child.kill();
    }
    
    let user_data_dir = get_chrome_user_data_dir()?;
    let chrome_path = find_chrome_executable()?;

    let child = Command::new(&chrome_path)
        .args(&[
            "--remote-debugging-port=9222",
            &format!("--user-data-dir={}", user_data_dir),
            "--no-first-run",
            "--no-default-browser-check",
        ])
        .spawn()
        .context("无法启动Chrome进程")?;
    
    *process_handle = Some(child);
    wait_for_debug_port().await
}

fn find_chrome_executable() -> Result<String> {
    let possible_paths = vec![
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ];
    for path in possible_paths {
        if std::path::Path::new(path).exists() {
            return Ok(path.to_string());
        }
    }
    Err(anyhow::anyhow!("未找到Chrome可执行文件"))
}

async fn wait_for_debug_port() -> Result<()> {
    let timeout = tokio::time::Duration::from_secs(30);
    let start = tokio::time::Instant::now();
    loop {
        if start.elapsed() > timeout {
            return Err(anyhow::anyhow!("等待Chrome调试端口超时 (30秒)"));
        }
        if check_chrome_debug_port().await {
            break;
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    }
    Ok(())
}

fn escape_js_string(s: &str) -> String {
    s.replace('\\', "\\\\").replace('\'', "\\'").replace('\"', "\\\"")
     .replace('\n', "\\n").replace('\r', "\\r").replace('\t', "\\t")
}

async fn save_case_record(_request: &AutomationRequest) -> Result<()> {
    tracing::info!("案件记录已保存 (模拟)。");
    Ok(())
}