use anyhow::Result;
use std::sync::Arc;
use tokio::sync::Mutex;
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
        started_at: Some(chrono::Utc::now()),
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

async fn run_automation_process(_request: Arc<AutomationRequest>) -> Result<()> {
    // Simplified automation process - mock implementation
    // Real implementation would use playwright for browser automation
    
    // Update progress
    let mut status = AUTOMATION_STATUS.lock().await;
    status.current_step = Some("正在处理...".to_string());
    status.progress = Some(50.0);
    drop(status);
    
    // Simulate work
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    
    // Complete
    let mut status = AUTOMATION_STATUS.lock().await;
    status.current_step = Some("完成".to_string());
    status.progress = Some(100.0);
    
    Ok(())
}