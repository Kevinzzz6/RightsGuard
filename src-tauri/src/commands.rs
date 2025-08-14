use serde::Serialize;
use uuid::Uuid;
use crate::database;
use crate::automation;
use crate::models::{Profile, IpAsset, Case, AutomationRequest, FileSelection, AutomationStatus};

// A serializable error type for Tauri commands
#[derive(Debug, thiserror::Error, Serialize)]
pub enum CommandError {
    #[error("Database error: {0}")]
    Database(String),
    #[error("Automation error: {0}")]
    Automation(String),
    #[error("UUID parsing error: {0}")]
    Uuid(String),
}

impl From<sqlx::Error> for CommandError {
    fn from(err: sqlx::Error) -> Self {
        CommandError::Database(err.to_string())
    }
}

impl From<anyhow::Error> for CommandError {
    fn from(err: anyhow::Error) -> Self {
        CommandError::Automation(err.to_string())
    }
}

// Helper to convert Uuid parse error
impl From<uuid::Error> for CommandError {
    fn from(err: uuid::Error) -> Self {
        CommandError::Uuid(err.to_string())
    }
}

// 个人档案相关命令
#[tauri::command]
pub async fn get_profile() -> Result<Option<Profile>, CommandError> {
    Ok(database::get_profile().await?)
}

#[tauri::command]
pub async fn save_profile(profile: Profile) -> Result<Profile, CommandError> {
    Ok(database::save_profile(&profile).await?)
}

// IP资产相关命令
#[tauri::command]
pub async fn get_ip_assets() -> Result<Vec<IpAsset>, CommandError> {
    Ok(database::get_ip_assets().await?)
}

#[tauri::command]
pub async fn get_ip_asset(id: String) -> Result<Option<IpAsset>, CommandError> {
    let uuid = Uuid::parse_str(&id)?;
    Ok(database::get_ip_asset(uuid).await?)
}

#[tauri::command]
pub async fn save_ip_asset(asset: IpAsset) -> Result<IpAsset, CommandError> {
    Ok(database::save_ip_asset(&asset).await?)
}

#[tauri::command]
pub async fn delete_ip_asset(id: String) -> Result<bool, CommandError> {
    let uuid = Uuid::parse_str(&id)?;
    database::delete_ip_asset(uuid).await?;
    Ok(true)
}

// 案件相关命令
#[tauri::command]
pub async fn get_cases() -> Result<Vec<Case>, CommandError> {
    Ok(database::get_cases().await?)
}

#[tauri::command]
pub async fn save_case(case: Case) -> Result<Case, CommandError> {
    Ok(database::save_case(&case).await?)
}

#[tauri::command]
pub async fn delete_case(id: String) -> Result<bool, CommandError> {
    let uuid = Uuid::parse_str(&id)?;
    database::delete_case(uuid).await?;
    Ok(true)
}

// 自动化相关命令
#[tauri::command]
pub async fn start_automation(infringing_url: String, original_url: Option<String>, ip_asset_id: Option<String>) -> Result<(), CommandError> {
    let request = AutomationRequest {
        infringing_url,
        original_url,
        ip_asset_id: ip_asset_id.map(|id| Uuid::parse_str(&id)).transpose()?,
    };
    automation::start_automation(request).await?;
    Ok(())
}

#[tauri::command]
pub async fn stop_automation() -> Result<(), CommandError> {
    automation::stop_automation().await?;
    Ok(())
}

#[tauri::command]
pub async fn get_automation_status() -> Result<AutomationStatus, CommandError> {
    Ok(automation::get_automation_status().await?)
}

// 文件相关命令
#[tauri::command]
pub async fn select_file(app: tauri::AppHandle) -> Result<FileSelection, CommandError> {
    use tauri_plugin_dialog::DialogExt;
    use std::sync::mpsc;
    
    let (tx, rx) = mpsc::channel();
    
    app.dialog()
        .file()
        .set_title("选择文件")
        .add_filter("图片文件", &["png", "jpg", "jpeg", "bmp", "gif"])
        .add_filter("PDF文件", &["pdf"])
        .add_filter("所有文件", &["*"])
        .pick_file(move |file_path| {
            let _ = tx.send(file_path);
        });
    
    let paths = match rx.recv() {
        Ok(Some(path)) => vec![path.to_string_lossy().to_string()],
        _ => vec![]
    };
    
    Ok(FileSelection { paths })
}

#[tauri::command]
pub async fn select_files(app: tauri::AppHandle) -> Result<FileSelection, CommandError> {
    use tauri_plugin_dialog::DialogExt;
    use std::sync::mpsc;
    
    let (tx, rx) = mpsc::channel();
    
    app.dialog()
        .file()
        .set_title("选择文件")
        .add_filter("图片文件", &["png", "jpg", "jpeg", "bmp", "gif"])
        .add_filter("PDF文件", &["pdf"])
        .add_filter("所有文件", &["*"])
        .pick_files(move |file_paths| {
            let _ = tx.send(file_paths);
        });
    
    let paths = match rx.recv() {
        Ok(Some(paths)) => paths.into_iter().map(|path| path.to_string_lossy().to_string()).collect(),
        _ => vec![]
    };
    
    Ok(FileSelection { paths })
}

// 系统相关命令
#[tauri::command]
pub async fn open_url(url: String, app: tauri::AppHandle) -> Result<(), CommandError> {
    use tauri_plugin_opener::OpenerExt;
    
    app.opener()
        .open_url(url, None::<String>)
        .map_err(|e| CommandError::Automation(format!("Failed to open URL: {}", e)))?;
    Ok(())
}

#[tauri::command]
pub async fn show_message(title: String, message: String, app: tauri::AppHandle) -> Result<(), CommandError> {
    use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
    use std::sync::mpsc;
    
    let (tx, rx) = mpsc::channel();
    
    app.dialog()
        .message(message)
        .title(title)
        .kind(MessageDialogKind::Info)
        .show(move |_| {
            let _ = tx.send(());
        });
    
    let _ = rx.recv(); // Wait for dialog to close
    Ok(())
}