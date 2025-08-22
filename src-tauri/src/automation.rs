// src-tauri/src/automation.rs

use anyhow::{Result, Context};
use std::sync::Arc;
use tokio::sync::Mutex;
use chrono::Utc;
use crate::models::{AutomationRequest, AutomationStatus};
use once_cell::sync::Lazy;
use std::process::{Command, Child};
use reqwest;
use serde_json;
use tauri::Manager;

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
    let escaped_name = &profile.name;
    let escaped_phone = &profile.phone;
    let escaped_email = &profile.email;
    let escaped_id_card = &profile.id_card_number;
    let escaped_infringing_url = &request.infringing_url;
    
    let waiting_file = project_root.join("waiting_for_verification.txt").to_string_lossy().to_string();
    let completed_file = project_root.join("verification_completed.txt").to_string_lossy().to_string();

    // Process profile files (identity card documents) - 确保使用真实身份证文件
    let id_card_files = get_absolute_file_paths(&profile.id_card_files)?;
    if id_card_files.is_empty() {
        tracing::warn!("⚠️ 个人档案中未配置身份证文件，请先在个人档案页面上传身份证正反面照片");
        return Err(anyhow::anyhow!("个人档案中未配置身份证文件。请先在个人档案页面上传身份证正反面照片。"));
    }
    tracing::info!("Profile ID card files resolved: {:?}", id_card_files);
    tracing::info!("✅ 身份证文件数量: {}，请确认包含正反面照片", id_card_files.len());

    // Process IP asset files if available
    let (auth_files, work_proof_files) = if let Some(asset) = ip_asset {
        let auth_files = get_absolute_file_paths(&asset.auth_files)?;
        let work_proof_files = get_absolute_file_paths(&asset.work_proof_files)?;
        tracing::info!("IP asset auth files resolved: {:?}", auth_files);
        tracing::info!("IP asset work proof files resolved: {:?}", work_proof_files);
        (auth_files, work_proof_files)
    } else {
        (Vec::new(), Vec::new())
    };

    // --- CRITICAL FIX: Handle the conditional logic in Rust ---
    let ip_section = if let Some(asset) = ip_asset {
        // If an IP asset exists, generate the full JavaScript block for it.
        format!(r#"
        console.log('开始填写IP资产信息...');
        await page.locator('.el-form-item:has-text("权利人") input.el-input__inner').first().fill({});
        await page.locator('.el-form-item:has-text("著作类型") .el-select').first().click();
        await page.waitForTimeout(500);
        await page.locator('.el-select-dropdown__item:has-text("{}")').first().click();
        await page.locator('.el-form-item:has-text("著作名称") input.el-input__inner').first().fill({});
        console.log('✓ IP资产信息填写完成');
        await page.locator('button:has-text("下一步")').first().click();
        await page.waitForTimeout(2000);
"#,
            serde_json::to_string(&asset.owner).unwrap(),
            &asset.work_type,  // This is used in selector text, keep as plain string
            serde_json::to_string(&asset.work_name).unwrap()
        )
    } else { 
        // If no IP asset, this string will be empty.
        "".to_string() 
    };

    // Generate file upload sections - Fixed to match B站 form structure
    let id_card_upload_section = if !id_card_files.is_empty() {
        let files_array = id_card_files.iter()
            .map(|path| escape_file_path_for_js_array(path))
            .collect::<Vec<_>>()
            .join(", ");
        let files_display = id_card_files.iter()
            .map(|path| {
                let filename = path.split(['/', '\\']).last().unwrap_or(path);
                serde_json::to_string(filename).unwrap()
            })
            .collect::<Vec<_>>()
            .join(", ");
        format!(r#"
        console.log('🆔 开始上传真实身份证文件（来自个人档案配置）...');
        console.log('📁 身份证文件列表:', [{}]);
        
        try {{
            const idCardFiles = [{}];
            console.log('📊 文件数量:', idCardFiles.length, '，请确认包含身份证正反面');
            
            // ✅ 验证身份证文件完整性
            console.log('🔍 身份证文件验证开始...');
            for (let i = 0; i < idCardFiles.length; i++) {{
                const filePath = idCardFiles[i];
                const fileName = filePath.split(/[/\\\\]/).pop();
                console.log(`📄 第${{i+1}}个文件: ${{fileName}}`);
                console.log(`📍 完整路径: ${{filePath}}`);
            }}
            
            if (idCardFiles.length === 1) {{
                console.log('⚠️ 只检测到1个身份证文件，建议上传正反面两张照片');
            }} else if (idCardFiles.length === 2) {{
                console.log('✅ 检测到2个身份证文件，符合正反面要求');
            }} else {{
                console.log(`📊 检测到${{idCardFiles.length}}个身份证文件`);
            }}
            
            // 🔍 第一步：详细DOM结构分析 - 专门针对版权图片上传区域
            console.log('🔍 开始版权图片上传区域DOM结构深度分析...');
            
            try {{
                // 直接定位版权图片上传区域
                const copyrightUploadArea = page.locator('.copyright-img-upload');
                const areaExists = await copyrightUploadArea.count();
                console.log(`📍 版权图片上传区域数量: ${{areaExists}}`);
                
                if (areaExists > 0) {{
                    // 获取版权上传区域的完整HTML结构
                    const areaHTML = await copyrightUploadArea.first().innerHTML();
                    console.log('📋 版权上传区域完整HTML:');
                    console.log(areaHTML);
                    
                    // 检查el-upload--picture-card元素
                    const pictureCardUpload = await copyrightUploadArea.first().locator('.el-upload--picture-card').count();
                    console.log(`🖼️ picture-card上传组件数量: ${{pictureCardUpload}}`);
                    
                    // 检查加号图标
                    const plusIcon = await copyrightUploadArea.first().locator('.el-icon-plus').count();
                    console.log(`➕ 加号图标数量: ${{plusIcon}}`);
                    
                    // 检查文件输入元素
                    const fileInputs = await copyrightUploadArea.first().locator('input[type="file"]').count();
                    console.log(`📁 文件输入元素数量: ${{fileInputs}}`);
                    
                    // 逐个检查文件输入元素的详细信息
                    for (let i = 0; i < fileInputs; i++) {{
                        const input = copyrightUploadArea.first().locator('input[type="file"]').nth(i);
                        const inputClass = await input.getAttribute('class') || '';
                        const inputName = await input.getAttribute('name') || '';
                        const isVisible = await input.isVisible();
                        console.log(`📁 FileInput[${{i}}]: class="${{inputClass}}", name="${{inputName}}", visible=${{isVisible}}`);
                    }}
                    
                    // 检查可点击的上传触发器
                    const clickableTriggers = await copyrightUploadArea.first().locator('[tabindex="0"], .el-upload--picture-card').count();
                    console.log(`👆 可点击上传触发器数量: ${{clickableTriggers}}`);
                    
                    // 检查上传列表区域
                    const uploadList = await copyrightUploadArea.first().locator('.el-upload-list').count();
                    console.log(`📋 上传列表区域数量: ${{uploadList}}`);
                    
                }} else {{
                    console.log('❌ 未找到.copyright-img-upload区域！');
                    
                    // 查找其他可能的上传区域
                    const allUploadElements = await page.locator('[class*="upload"]').count();
                    console.log(`🔍 页面所有包含upload的元素数量: ${{allUploadElements}}`);
                    
                    const allFileInputs = await page.locator('input[type="file"]').count();
                    console.log(`📁 页面所有文件输入数量: ${{allFileInputs}}`);
                    
                    // 显示页面所有可能相关的class
                    const uploadClasses = await page.locator('[class*="upload"], [class*="img"], [class*="picture"]').allInnerTexts();
                    console.log('🎨 可能相关的上传元素:', uploadClasses.slice(0, 10));
                }}
            }} catch (domError) {{
                console.error('❌ DOM分析失败:', domError.message);
            }}
            
            // 🎯 基于新Playwright录制的精确方法
            const selectorStrategies = [
                // 策略1: 新Playwright录制 - 先点击加号图标，再设置文件
                {{ selector: 'form i:nth-child(2)', uploadSelector: '.el-upload', type: 'icon_click', name: '表单加号图标点击' }},
                // 策略2: 更通用的加号图标定位
                {{ selector: 'form i', uploadSelector: '.el-upload', type: 'icon_click_all', name: '表单所有图标尝试' }},
                // 策略3: 直接.el-upload方法（简化版）
                {{ selector: '.el-upload', type: 'direct_simple', name: '直接el-upload上传' }},
                // 策略4: 版权区域内的.el-upload
                {{ selector: '.copyright-img-upload .el-upload', type: 'direct_simple', name: '版权区域el-upload' }},
                // 策略5: 文件输入备选
                {{ selector: '.el-upload__input', type: 'input', name: '文件输入备选' }},
                // 策略6: FileChooser备选
                {{ selector: '.el-upload', type: 'chooser', name: 'FileChooser备选' }}
            ];
            
            console.log('🔍 开始6级智能选择器检测（基于Playwright录制）...');
            let uploadSuccess = false;
            
            for (let i = 0; i < selectorStrategies.length && !uploadSuccess; i++) {{
                const strategy = selectorStrategies[i];
                console.log(`🎯 尝试策略${{i+1}}: ${{strategy.name}} (${{strategy.selector}})`);
                
                try {{
                    if (strategy.type === 'icon_click') {{
                        // 新录制方法: 先点击加号图标，再设置文件
                        const iconElement = page.locator(strategy.selector).nth(1);
                        const uploadElement = page.locator(strategy.uploadSelector).first();
                        
                        const iconVisible = await iconElement.isVisible({{ timeout: 3000 }});
                        const uploadVisible = await uploadElement.isVisible({{ timeout: 3000 }});
                        console.log(`   加号图标可见性: ${{iconVisible}}, 上传元素可见性: ${{uploadVisible}}`);
                        
                        if (iconVisible && uploadVisible) {{
                            console.log(`🎯 使用新Playwright录制方法: 点击加号图标 + setInputFiles`);
                            
                            // 步骤1: 点击加号图标
                            await iconElement.click();
                            console.log(`👆 已点击加号图标: ${{strategy.selector}}`);
                            
                            // 步骤2: 设置文件到.el-upload
                            await page.waitForTimeout(500);
                            await uploadElement.setInputFiles(idCardFiles);
                            console.log(`📁 已设置文件到上传元素`);
                            
                            console.log(`✅ 策略${{i+1}}加号点击方法完成: ${{strategy.name}}`);
                            
                            // 验证上传成功
                            await page.waitForTimeout(3000);
                            const uploadItems = await page.locator('.el-upload-list__item').count();
                            console.log(`📊 检测到上传项目数量: ${{uploadItems}}`);
                            
                            if (uploadItems > 0) {{
                                uploadSuccess = true;
                                console.log(`🎉 加号点击方法上传成功，使用策略${{i+1}}: ${{strategy.name}}`);
                                console.log(`🛑 文件上传成功，停止其他策略尝试`);
                                
                                // 防止页面晃动 - 停止所有页面滚动和鼠标事件
                                await page.evaluate(() => {{
                                    document.body.style.overflow = 'hidden';
                                    window.scrollTo(0, 0);
                                }});
                                await page.waitForTimeout(1000);
                                await page.evaluate(() => {{
                                    document.body.style.overflow = 'auto';
                                }});
                                break; // 立即退出策略循环
                            }}
                        }}
                        
                    }} else if (strategy.type === 'icon_click_all') {{
                        // 尝试所有加号图标
                        const iconElements = await page.locator(strategy.selector).all();
                        const uploadElement = page.locator(strategy.uploadSelector).first();
                        
                        console.log(`   找到${{iconElements.length}}个图标元素`);
                        
                        for (let iconIndex = 0; iconIndex < iconElements.length; iconIndex++) {{
                            try {{
                                const icon = iconElements[iconIndex];
                                const iconVisible = await icon.isVisible();
                                if (iconVisible) {{
                                    console.log(`🎯 尝试点击第${{iconIndex + 1}}个图标`);
                                    await icon.click();
                                    await page.waitForTimeout(500);
                                    await uploadElement.setInputFiles(idCardFiles);
                                    
                                    await page.waitForTimeout(2000);
                                    const uploadItems = await page.locator('.el-upload-list__item').count();
                                    if (uploadItems > 0) {{
                                        uploadSuccess = true;
                                        console.log(`🎉 第${{iconIndex + 1}}个图标点击成功`);
                                        console.log(`🛑 文件上传成功，停止策略尝试`);
                                        
                                        // 防止页面晃动 - 停止所有页面滚动
                                        await page.evaluate(() => {{
                                            document.body.style.overflow = 'hidden';
                                            window.scrollTo(0, 0);
                                        }});
                                        await page.waitForTimeout(1000);
                                        await page.evaluate(() => {{
                                            document.body.style.overflow = 'auto';
                                        }});
                                        break; // 退出图标循环
                                    }}
                                }}
                            }} catch (iconError) {{
                                console.log(`❌ 第${{iconIndex + 1}}个图标点击失败: ${{iconError.message}}`);
                            }}
                        }}
                        
                    }} else if (strategy.type === 'direct_simple') {{
                        // 简化的直接方法 - 只setInputFiles一次
                        const uploadElement = page.locator(strategy.selector).first();
                        const isVisible = await uploadElement.isVisible({{ timeout: 3000 }});
                        console.log(`   上传元素可见性: ${{isVisible}}`);
                        
                        if (isVisible) {{
                            console.log(`🎯 使用简化直接方法: 直接setInputFiles`);
                            await uploadElement.setInputFiles(idCardFiles);
                            console.log(`📁 已设置文件: ${{strategy.selector}}`);
                            
                            await page.waitForTimeout(3000);
                            const uploadItems = await page.locator('.el-upload-list__item').count();
                            console.log(`📊 检测到上传项目数量: ${{uploadItems}}`);
                            
                            if (uploadItems > 0) {{
                                uploadSuccess = true;
                                console.log(`🎉 简化直接方法上传成功，使用策略${{i+1}}: ${{strategy.name}}`);
                                console.log(`🛑 文件上传成功，停止其他策略尝试`);
                                
                                // 防止页面晃动
                                await page.evaluate(() => {{
                                    document.body.style.overflow = 'hidden';
                                    window.scrollTo(0, 0);
                                }});
                                await page.waitForTimeout(1000);
                                await page.evaluate(() => {{
                                    document.body.style.overflow = 'auto';
                                }});
                                break; // 立即退出策略循环
                            }}
                        }}
                        
                    }} else if (strategy.type === 'input') {{
                        // 直接文件输入策略
                        const element = page.locator(strategy.selector).first();
                        const isVisible = await element.isVisible({{ timeout: 3000 }});
                        console.log(`   可见性: ${{isVisible}}`);
                        
                        if (isVisible) {{
                            await element.setInputFiles(idCardFiles);
                            console.log(`✅ 策略${{i+1}}成功: ${{strategy.name}}`);
                            
                            // 验证上传成功
                            await page.waitForTimeout(2000);
                            const uploadItems = await page.locator('.el-upload-list__item, .upload-list-item, .el-upload-list .el-upload-list__item').count();
                            console.log(`📊 检测到上传项目数量: ${{uploadItems}}`);
                            
                            if (uploadItems > 0) {{
                                uploadSuccess = true;
                                console.log(`🎉 文件上传验证成功，使用策略${{i+1}}: ${{strategy.name}}`);
                                console.log(`🛑 文件上传成功，停止其他策略尝试`);
                                
                                // 防止页面晃动
                                await page.evaluate(() => {{
                                    document.body.style.overflow = 'hidden';
                                    window.scrollTo(0, 0);
                                }});
                                await page.waitForTimeout(1000);
                                await page.evaluate(() => {{
                                    document.body.style.overflow = 'auto';
                                }});
                                break; // 立即退出策略循环
                            }}
                        }}
                        
                    }} else if (strategy.type === 'chooser') {{
                        // File Chooser API策略 - 优化版本
                        const trigger = page.locator(strategy.selector).first();
                        const isVisible = await trigger.isVisible({{ timeout: 3000 }});
                        console.log(`   上传触发器可见性: ${{isVisible}}`);
                        
                        if (isVisible) {{
                            console.log(`🎯 准备点击上传触发器: ${{strategy.selector}}`);
                            
                            // 设置文件选择器监听 - 增加超时时间
                            const fileChooserPromise = page.waitForEvent('filechooser', {{ timeout: 10000 }});
                            
                            // 点击触发器
                            await trigger.click();
                            console.log(`👆 已点击上传触发器，等待文件选择器...`);
                            
                            try {{
                                const fileChooser = await fileChooserPromise;
                                console.log(`📁 文件选择器已打开，设置文件:`, idCardFiles);
                                
                                await fileChooser.setFiles(idCardFiles);
                                console.log(`✅ 策略${{i+1}}文件选择完成: ${{strategy.name}}`);
                                
                                // 等待上传处理
                                await page.waitForTimeout(4000);
                                
                                // 验证上传成功 - 检查多种可能的上传成功指示器
                                const uploadItemsVariants = [
                                    '.copyright-img-upload .el-upload-list__item',
                                    '.el-upload-list--picture-card .el-upload-list__item', 
                                    '.el-upload-list__item',
                                    '[class*="upload-list"] [class*="item"]'
                                ];
                                
                                let totalUploadItems = 0;
                                for (const variant of uploadItemsVariants) {{
                                    const count = await page.locator(variant).count();
                                    if (count > 0) {{
                                        console.log(`📊 找到${{count}}个上传项目 (选择器: ${{variant}})`);
                                        totalUploadItems = Math.max(totalUploadItems, count);
                                    }}
                                }}
                                
                                console.log(`📊 总上传项目数量: ${{totalUploadItems}}`);
                                
                                if (totalUploadItems > 0) {{
                                    uploadSuccess = true;
                                    console.log(`🎉 文件上传验证成功，使用策略${{i+1}}: ${{strategy.name}}`);
                                    
                                    // 防止页面晃动
                                    await page.evaluate(() => {{
                                        document.body.style.overflow = 'hidden';
                                        window.scrollTo(0, 0);
                                    }});
                                    await page.waitForTimeout(1000);
                                    await page.evaluate(() => {{
                                        document.body.style.overflow = 'auto';
                                    }});
                                }} else {{
                                    console.log(`⚠️ 策略${{i+1}}文件选择成功但未检测到上传项目`);
                                }}
                                
                            }} catch (chooserError) {{
                                console.log(`❌ 策略${{i+1}}文件选择器超时或失败: ${{chooserError.message}}`);
                            }}
                        }}
                    }}
                    
                }} catch (strategyError) {{
                    console.log(`❌ 策略${{i+1}}失败: ${{strategyError.message}}`);
                }}
            }}
            
            if (!uploadSuccess) {{
                console.log('⚠️ 所有6种选择器策略均未成功');
                
                // 🔍 增强调试信息 - DOM结构分析
                console.log('🔍 开始页面DOM结构分析...');
                const allFileInputs = await page.locator('input[type="file"]').count();
                console.log(`🔍 页面总文件输入控件数量: ${{allFileInputs}}`);
                
                // 列出所有表单项的文本内容
                try {{
                    const formItems = await page.locator('.el-form-item').allTextContents();
                    console.log('🔍 页面表单项文本: ', formItems);
                    
                    // 检查上传相关元素
                    const uploadElements = await page.locator('.el-upload, [class*="upload"]').count();
                    console.log(`🔍 上传相关元素数量: ${{uploadElements}}`);
                    
                    // 检查按钮元素
                    const buttons = await page.locator('button, .el-button').allTextContents();
                    console.log('🔍 页面按钮文本: ', buttons.slice(0, 10)); // 前10个
                    
                }} catch (debugError) {{
                    console.log('调试信息获取失败:', debugError.message);
                }}
            }}
            
        }} catch (error) {{
            console.error('❌ 身份证文件上传整体失败: ', error);
        }}"#, files_display, files_array)
    } else {
        "        console.log('ℹ️ 无身份证文件需要上传');".to_string()
    };

    let auth_files_upload_section = if !auth_files.is_empty() {
        let files_array = auth_files.iter()
            .map(|path| escape_file_path_for_js_array(path))
            .collect::<Vec<_>>()
            .join(", ");
        let files_display = auth_files.iter()
            .map(|path| {
                let filename = path.split(['/', '\\']).last().unwrap_or(path);
                serde_json::to_string(filename).unwrap()
            })
            .collect::<Vec<_>>()
            .join(", ");
        format!(r#"
        console.log('📋 开始上传授权证明文件...');
        console.log('📁 文件列表:', [{}]);
        
        try {{
            const authFiles = [{}];
            const authFileInput = page.locator('.el-form-item:has-text("授权证明") input[type="file"]');
            await page.waitForTimeout(1000); // Wait for form to be ready
            
            const isVisible = await authFileInput.isVisible({{ timeout: 5000 }});
            console.log('🔍 授权证明文件上传控件可见性: ', isVisible);
            
            if (isVisible) {{
                await authFileInput.setInputFiles(authFiles);
                console.log('✅ 授权证明文件上传完成，文件数量:', authFiles.length);
                
                // Wait and check for upload success
                await page.waitForTimeout(3000);
                const uploadSuccess = await page.locator('.el-form-item:has-text("授权证明") .el-upload-list__item').count();
                console.log('📊 上传成功文件数量: ', uploadSuccess);
                
            }} else {{
                console.log('⚠️ 授权证明文件上传控件未找到');
                // Alternative selector attempts
                const altSelector1 = await page.locator('.el-form-item:has-text("授权") input[type="file"]').isVisible({{ timeout: 1000 }});
                const altSelector2 = await page.locator('input[type="file"][accept*="image"]').count();
                console.log('🔍 备用选择器1可见性: ', altSelector1);
                console.log('🔍 图片文件输入数量: ', altSelector2);
            }}
        }} catch (error) {{
            console.error('❌ 授权证明文件上传失败: ', error);
        }}"#, files_display, files_array)
    } else {
        "        console.log('ℹ️ 无授权证明文件需要上传');".to_string()
    };

    let work_proof_upload_section = if !work_proof_files.is_empty() {
        let files_array = work_proof_files.iter()
            .map(|path| escape_file_path_for_js_array(path))
            .collect::<Vec<_>>()
            .join(", ");
        let files_display = work_proof_files.iter()
            .map(|path| {
                let filename = path.split(['/', '\\']).last().unwrap_or(path);
                serde_json::to_string(filename).unwrap()
            })
            .collect::<Vec<_>>()
            .join(", ");
        format!(r#"
        console.log('🏆 开始上传作品证明文件...');
        console.log('📁 文件列表:', [{}]);
        
        try {{
            const workProofFiles = [{}];
            // Use .last() because "证明" may appear multiple times on the page
            const workProofFileInput = page.locator('.el-form-item:has-text("证明")').last().locator('input[type="file"]');
            await page.waitForTimeout(1000); // Wait for form to be ready
            
            const isVisible = await workProofFileInput.isVisible({{ timeout: 5000 }});
            console.log('🔍 作品证明文件上传控件可见性: ', isVisible);
            
            if (isVisible) {{
                await workProofFileInput.setInputFiles(workProofFiles);
                console.log('✅ 作品证明文件上传完成，文件数量:', workProofFiles.length);
                
                // Wait and check for upload success
                await page.waitForTimeout(3000);
                const uploadSuccess = await page.locator('.el-form-item:has-text("证明")').last().locator('.el-upload-list__item').count();
                console.log('📊 上传成功文件数量: ', uploadSuccess);
                
            }} else {{
                console.log('⚠️ 作品证明文件上传控件未找到');
                // Debug: Count all "证明" form items
                const allProofItems = await page.locator('.el-form-item:has-text("证明")').count();
                console.log('🔍 页面"证明"表单项数量: ', allProofItems);
                
                // Try alternative selectors
                const altSelector = await page.locator('.el-form-item').filter({{ hasText: /证明|证书/ }}).last().locator('input[type="file"]').isVisible({{ timeout: 1000 }});
                console.log('🔍 备用选择器可见性: ', altSelector);
            }}
        }} catch (error) {{
            console.error('❌ 作品证明文件上传失败: ', error);
        }}"#, files_display, files_array)
    } else {
        "        console.log('ℹ️ 无作品证明文件需要上传');".to_string()
    };

    // The main script template now includes file upload functionality
    Ok(format!(r#"
const {{ test, chromium }} = require('@playwright/test');
const fs = require('fs');

test('Bilibili Appeal - Connect Mode with File Upload', async () => {{
    try {{
        console.log('🚀 开始自动化申诉流程...');
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222', {{ timeout: 15000 }});
        const context = browser.contexts()[0];
        const page = context.pages()[0] || await context.newPage();
        
        console.log('📄 导航到B站版权申诉页面...');
        await page.goto('https://www.bilibili.com/v/copyright/apply?origin=home', {{ timeout: 60000, waitUntil: 'networkidle' }});

        console.log('✏️ 开始填写个人信息...');
        await page.locator('input[placeholder="真实姓名"].el-input__inner').first().fill({name});
        await page.locator('input[placeholder="手机号"].el-input__inner').first().fill({phone});
        await page.locator('.el-form-item:has-text("邮箱") input.el-input__inner').first().fill({email});
        await page.locator('input[placeholder="证件号码"].el-input__inner').first().fill({id_card});
        console.log('✓ 个人信息填写完成');

        {id_card_upload_section}
        
        console.log('⏳ 等待用户完成人工验证...');
        fs.writeFileSync({waiting_file}, 'waiting');
        while (true) {{
            if (fs.existsSync({completed_file})) {{
                fs.unlinkSync({completed_file});
                fs.unlinkSync({waiting_file});
                break;
            }}
            await page.waitForTimeout(1000);
        }}
        console.log('✓ 人工验证已完成');
        
        await page.locator('button:has-text("下一步")').first().click();
        await page.waitForTimeout(2000);
        
        // This is now safe, as ip_section is either a valid block of code or an empty string.
        {ip_section}

        {auth_files_upload_section}

        {work_proof_upload_section}
        
        console.log('📝 填写申诉详情...');
        await page.locator('input[placeholder*="他人发布的B站侵权链接"]').first().fill({url});
        await page.locator('textarea[placeholder*="该链接内容全部"]').first().fill('该链接内容侵犯了我的版权，要求立即删除。');
        await page.locator('.el-checkbox__label:has-text("本人保证")').first().click();
        console.log('✓ 申诉详情填写完成');
        
        console.log('🎉 自动化申诉流程准备就绪，保持页面打开供用户最终确认...');
        await new Promise(() => {{}}); // Keep open indefinitely
    }} catch (error) {{
        console.error('❌ 自动化申诉流程失败:', error);
        throw error;
    }}
}});
"#, 
    name = serde_json::to_string(escaped_name).unwrap(), 
    phone = serde_json::to_string(escaped_phone).unwrap(), 
    email = serde_json::to_string(escaped_email).unwrap(), 
    id_card = serde_json::to_string(escaped_id_card).unwrap(), 
    ip_section = ip_section, 
    url = serde_json::to_string(escaped_infringing_url).unwrap(), 
    waiting_file = serde_json::to_string(&waiting_file).unwrap(), 
    completed_file = serde_json::to_string(&completed_file).unwrap(),
    id_card_upload_section = id_card_upload_section,
    auth_files_upload_section = auth_files_upload_section,
    work_proof_upload_section = work_proof_upload_section
))
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


fn escape_file_path_for_js_array(path: &str) -> String {
    // For file paths in JavaScript arrays, we need proper JSON escaping
    serde_json::to_string(path).unwrap_or_else(|_| "\"\"".to_string())
}

async fn save_case_record(_request: &AutomationRequest) -> Result<()> {
    tracing::info!("案件记录已保存 (模拟)。");
    Ok(())
}

// Helper function to convert relative file paths to absolute paths
fn get_absolute_file_paths(file_paths_json: &Option<String>) -> Result<Vec<String>> {
    let paths_json = match file_paths_json {
        Some(json_str) if !json_str.trim().is_empty() => json_str,
        _ => return Ok(Vec::new()),
    };
    
    // Try to parse as JSON array first, then as comma-separated string
    let paths: Vec<String> = if paths_json.trim().starts_with('[') {
        serde_json::from_str(paths_json)
            .context("Failed to parse file paths JSON")?
    } else {
        // Treat as array of strings (current format)
        paths_json.split(',').map(|s| s.trim().to_string()).collect()
    };
    
    let mut absolute_paths = Vec::new();
    let paths_count = paths.len();
    
    for relative_path in &paths {
        if relative_path.trim().is_empty() {
            continue;
        }
        
        // If path starts with "files/", it's a relative app data path
        if relative_path.starts_with("files/") {
            // Get absolute path using app handle
            if let Ok(app_handle_guard) = crate::database::APP_HANDLE.lock() {
                if let Some(app_handle) = app_handle_guard.as_ref() {
                    if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
                        let abs_path = app_data_dir.join(relative_path);
                        if abs_path.exists() {
                            absolute_paths.push(abs_path.to_string_lossy().to_string());
                            tracing::info!("Resolved file path: {} -> {}", relative_path, abs_path.display());
                        } else {
                            tracing::warn!("File does not exist: {}", abs_path.display());
                        }
                        continue;
                    }
                }
            }
            tracing::warn!("Failed to resolve app data path for: {}", relative_path);
        } else {
            // Handle absolute paths - might be legacy data
            let path = std::path::Path::new(relative_path);
            if path.exists() {
                // Check if this absolute path is outside app data directory
                // If so, try to find corresponding file in app data directory
                if let Ok(app_handle_guard) = crate::database::APP_HANDLE.lock() {
                    if let Some(app_handle) = app_handle_guard.as_ref() {
                        if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
                            let app_data_str = app_data_dir.to_string_lossy();
                            
                            // If absolute path is outside app data directory
                            if !relative_path.starts_with(&*app_data_str) {
                                // Try to find corresponding file in app data directory
                                let mut found_in_app_data = false;
                                if let Some(filename) = path.file_name() {
                                    // Search in common locations
                                    let search_paths = [
                                        app_data_dir.join("files").join("ip_assets").join("auth_docs").join(filename),
                                        app_data_dir.join("files").join("ip_assets").join("proof_docs").join(filename),
                                        app_data_dir.join("files").join("profiles").join("id_cards").join(filename),
                                    ];
                                    
                                    for search_path in &search_paths {
                                        if search_path.exists() {
                                            absolute_paths.push(search_path.to_string_lossy().to_string());
                                            tracing::info!("Found corresponding file in app data: {} -> {}", relative_path, search_path.display());
                                            found_in_app_data = true;
                                            break;
                                        }
                                    }
                                }
                                
                                // If not found in app data, use original absolute path
                                if !found_in_app_data {
                                    absolute_paths.push(relative_path.clone());
                                    tracing::info!("Using existing absolute path (not found in app data): {}", relative_path);
                                }
                            } else {
                                // Already in app data directory
                                absolute_paths.push(relative_path.clone());
                                tracing::info!("Using existing absolute path: {}", relative_path);
                            }
                        } else {
                            absolute_paths.push(relative_path.clone());
                            tracing::info!("Using existing absolute path: {}", relative_path);
                        }
                    } else {
                        absolute_paths.push(relative_path.clone());
                        tracing::info!("Using existing absolute path: {}", relative_path);
                    }
                } else {
                    absolute_paths.push(relative_path.clone());
                    tracing::info!("Using existing absolute path: {}", relative_path);
                }
            } else {
                tracing::warn!("Absolute file path does not exist: {}", relative_path);
            }
        }
    }
    
    tracing::info!("Resolved {} file paths from {} input paths", absolute_paths.len(), paths_count);
    Ok(absolute_paths)
}