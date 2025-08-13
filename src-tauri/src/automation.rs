use anyhow::{Result, anyhow};
use playwright::{Playwright, Error};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use crate::models::{AutomationRequest, AutomationStatus};
use crate::database;
use once_cell::sync::Lazy;


static AUTOMATION_STATUS: Lazy<Arc<Mutex<AutomationStatus>>> = 
    Lazy::new(|| Arc::new(Mutex::new(AutomationStatus {
        is_running: false,
        current_step: None,
        progress: None,
        error: None,
        started_at: None,
    })));

pub async fn start_automation(request: AutomationRequest) -> Result<()> {
    let mut status = AUTOMATION_STATUS.lock().await;
    
    if status.is_running {
        return Err(anyhow!("自动化流程已在运行中"));
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
    
    if !status.is_running {
        return Err(anyhow!("没有正在运行的自动化流程"));
    }
    
    *status = AutomationStatus {
        is_running: false,
        current_step: Some("已停止".to_string()),
        progress: None,
        error: Some("用户手动停止".to_string()),
        started_at: None,
    };
    
    Ok(())
}

pub async fn get_automation_status() -> Result<AutomationStatus> {
    let status = AUTOMATION_STATUS.lock().await;
    Ok(status.clone())
}

async fn run_automation_process(request: Arc<AutomationRequest>) -> Result<(), Error> {
    // 更新状态
    {
        let mut status = AUTOMATION_STATUS.lock().await;
        status.current_step = Some("启动浏览器".to_string());
        status.progress = Some(10.0);
    }
    
    let playwright = Playwright::initialize().await?;
    playwright.prepare()?; // Installs browsers
    let chromium = playwright.chromium();
    let browser = chromium.launcher().headless(false).launch().await?;
    let context = browser.context_builder().build().await?;
    let page = context.new_page().await?;
    
    // 步骤1：导航到B站版权中心
    {
        let mut status = AUTOMATION_STATUS.lock().await;
        status.current_step = Some("导航到B站版权中心".to_string());
        status.progress = Some(20.0);
    }
    
    page.goto_builder("https://www.bilibili.com/v/copyright/apply?origin=home").goto().await?;
    
    // 等待页面加载
    page.wait_for_load_state("networkidle", None).await?;
    
    // 步骤2：资质认证
    {
        let mut status = AUTOMATION_STATUS.lock().await;
        status.current_step = Some("资质认证".to_string());
        status.progress = Some(30.0);
    }
    
    // 获取个人档案数据
    let profile = database::get_profile().await.map_err(|e| Error::Other(e.to_string()))?
        .ok_or_else(|| Error::Other("未找到个人档案，请先配置个人信息".into()))?;
    
    // 填写名称
    let name_selector = r#"input[placeholder="真实姓名"]"#;
    page.wait_for_selector(name_selector, None).await?;
    page.fill(name_selector, &profile.name, None).await?;
    
    // 填写手机号
    let phone_selector = r#"input[placeholder="手机号"]"#;
    page.wait_for_selector(phone_selector, None).await?;
    page.fill(phone_selector, &profile.phone, None).await?;
    
    // 填写邮箱
    let email_selector = r#".el-form-item:has-text("邮箱") input"#;
    page.wait_for_selector(email_selector, None).await?;
    page.fill(email_selector, &profile.email, None).await?;
    
    // 填写身份证号
    let id_card_selector = r#"input[placeholder="证件号码"]"#;
    page.wait_for_selector(id_card_selector, None).await?;
    page.fill(id_card_selector, &profile.id_card_number, None).await?;
    
    // 上传证件照片（如果有）
    if let Some(files_json) = profile.id_card_files {
        let files: Vec<String> = serde_json::from_str(&files_json).map_err(|e| Error::Other(e.to_string()))?;
        if !files.is_empty() {
            let file_selector = r#".el-form-item:has-text("证件证明") input[type="file"]"#;
            page.wait_for_selector(file_selector, None).await?;
            page.set_input_files(file_selector, &files, None).await?;
        }
    }
    
    // 暂停，等待用户手动完成验证码
    {
        let mut status = AUTOMATION_STATUS.lock().await;
        status.current_step = Some("等待用户完成验证码".to_string());
        status.progress = Some(50.0);
    }
    
    tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
    
    // 点击下一步
    let next_button_selector = r#"button:has-text("下一步")"#;
    page.wait_for_selector(next_button_selector, None).await?;
    page.click_builder(next_button_selector).click().await?;
    
    // 步骤3：权益认证
    {
        let mut status = AUTOMATION_STATUS.lock().await;
        status.current_step = Some("权益认证".to_string());
        status.progress = Some(70.0);
    }
    
    let ip_asset = if let Some(ip_id) = request.ip_asset_id {
        database::get_ip_asset(ip_id).await.map_err(|e| Error::Other(e.to_string()))?
            .ok_or_else(|| Error::Other("未找到指定的IP资产".into()))?
    } else {
        return Err(Error::Other("未指定IP资产".into()));
    };
    
    let owner_selector = r#".el-form-item:has-text("权利人") input"#;
    page.wait_for_selector(owner_selector, None).await?;
    page.fill(owner_selector, &ip_asset.owner, None).await?;
    
    if let (Some(start_date), Some(end_date)) = (&ip_asset.auth_start_date, &ip_asset.auth_end_date) {
        let auth_start_selector = r#"input[placeholder="起始时间"]"#;
        page.wait_for_selector(auth_start_selector, None).await?;
        page.fill(auth_start_selector, start_date, None).await?;
        
        let auth_end_selector = r#"input[placeholder="结束时间"]"#;
        page.wait_for_selector(auth_end_selector, None).await?;
        page.fill(auth_end_selector, end_date, None).await?;
    }
    
    if let Some(files_json) = ip_asset.auth_files {
        let files: Vec<String> = serde_json::from_str(&files_json).map_err(|e| Error::Other(e.to_string()))?;
        if !files.is_empty() {
            let auth_file_selector = r#".el-form-item:has-text("授权证明") input[type="file"]"#;
            page.wait_for_selector(auth_file_selector, None).await?;
            page.set_input_files(auth_file_selector, &files, None).await?;
        }
    }
    
    let work_type_selector = r#".el-form-item:has-text("著作类型")"#;
    page.wait_for_selector(work_type_selector, None).await?;
    page.click_builder(work_type_selector).click().await?;
    
    let work_type_option_selector = &format!(r#".el-select-dropdown__item:has-text("{}")"#, ip_asset.work_type);
    page.wait_for_selector(work_type_option_selector, None).await?;
    page.click_builder(work_type_option_selector).click().await?;
    
    let work_name_selector = r#".el-form-item:has-text("著作名称") input"#;
    page.wait_for_selector(work_name_selector, None).await?;
    page.fill(work_name_selector, &ip_asset.work_name, None).await?;
    
    let work_start_selector = r#"input[placeholder="起始时间"]"#;
    page.wait_for_selector(work_start_selector, None).await?;
    page.fill(work_start_selector, &ip_asset.work_start_date, None).await?;
    
    let work_end_selector = r#"input[placeholder="结束时间"]"#;
    page.wait_for_selector(work_end_selector, None).await?;
    page.fill(work_end_selector, &ip_asset.work_end_date, None).await?;
    
    if let Some(files_json) = ip_asset.work_proof_files {
        let files: Vec<String> = serde_json::from_str(&files_json).map_err(|e| Error::Other(e.to_string()))?;
        if !files.is_empty() {
            let proof_file_selector = r#".el-form-item:has-text("证明") input[type="file"]"#;
            page.wait_for_selector(proof_file_selector, None).await?;
            page.set_input_files(proof_file_selector, &files, None).await?;
        }
    }
    
    page.click_builder(next_button_selector).click().await?;
    
    {
        let mut status = AUTOMATION_STATUS.lock().await;
        status.current_step = Some("申诉请求".to_string());
        status.progress = Some(90.0);
    }
    
    let infringing_url_selector = r#"input[placeholder*="他人发布的B站侵权链接"]"#;
    page.wait_for_selector(infringing_url_selector, None).await?;
    page.fill(infringing_url_selector, &request.infringing_url, None).await?;
    
    let description = "该链接内容全部侵犯了本人的知识产权，未经本人授权使用。本人对该内容拥有完整的知识产权，要求B站平台立即删除侵权内容。";
    let description_selector = r#"textarea[placeholder*="该链接内容全部"]"#;
    page.wait_for_selector(description_selector, None).await?;
    page.fill(description_selector, description, None).await?;
    
    if let Some(original_url) = &request.original_url {
        let original_url_selector = r#".textarea-wrapper:has-text("原创链接") input"#;
        page.wait_for_selector(original_url_selector, None).await?;
        page.fill(original_url_selector, original_url, None).await?;
    }
    
    let checkbox_selector = r#".el-checkbox__label:has-text("本人保证")"#;
    page.wait_for_selector(checkbox_selector, None).await?;
    page.click_builder(checkbox_selector).click().await?;
    
    let submit_button_selector = r#"button:has-text("提交")"#;
    page.wait_for_selector(submit_button_selector, None).await?;
    page.click_builder(submit_button_selector).click().await?;
    
    page.wait_for_load_state("networkidle", None).await?;
    
    let case_data = crate::models::Case {
        id: None,
        infringing_url: request.infringing_url.clone(),
        original_url: request.original_url.clone(),
        associated_ip_id: request.ip_asset_id,
        status: "已提交".to_string(),
        submission_date: Some(Utc::now()),
        created_at: None,
        updated_at: None,
    };
    
    database::save_case(&case_data).await.map_err(|e| Error::Other(e.to_string()))?;
    
    browser.close().await?;
    
    Ok(())
}