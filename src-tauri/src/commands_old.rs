use tauri::{AppHandle, Manager};
use serde::{Deserialize, Serialize};
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
    Ok(database::delete_ip_asset(uuid).await?)
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
    Ok(database::delete_case(uuid).await?)
}

// 自动化相关命令
#[tauri::command]
pub async fn start_automation(
    infringing_url: String,
    original_url: Option<String>,
    ip_asset_id: Option<String>,
) -> Result<(), CommandError> {
    let ip_asset_uuid = ip_asset_id.map(|id| Uuid::parse_str(&id)).transpose()?;
    
    let request = AutomationRequest {
        infringing_url,
        original_url,
        ip_asset_id: ip_asset_uuid,
    };
    
    Ok(automation::start_automation(request).await?)
}

#[tauri::command]
pub async fn stop_automation() -> Result<(), CommandError> {
    Ok(automation::stop_automation().await?)
}

#[tauri::command]
pub async fn get_automation_status() -> Result<AutomationStatus, CommandError> {
    Ok(automation::get_automation_status().await?)
}

// 文件相关命令
#[tauri::command]
pub async fn select_file(app: AppHandle) -> Result<FileSelection, CommandError> {
    use tauri::api::dialog::FileDialogBuilder;
    
    let (sender, receiver) = std::sync::mpsc::channel();
    FileDialogBuilder::new(&app).pick_file(move |path| {
        sender.send(path).unwrap();
    });

    let path = receiver.recv().unwrap();

    match path {
        Some(p) => Ok(FileSelection {
            paths: vec![p.to_string_lossy().to_string()],
        }),
        None => Ok(FileSelection { paths: vec![] }),
    }
}

#[tauri::command]
pub async fn select_files(app: AppHandle) -> Result<FileSelection, CommandError> {
    use tauri::api::dialog::FileDialogBuilder;

    let (sender, receiver) = std::sync::mpsc::channel();
    FileDialogBuilder::new(&app).pick_files(move |paths| {
        sender.send(paths).unwrap();
    });

    let paths = receiver.recv().unwrap();
    
    match paths {
        Some(p) => {
            let path_strings: Vec<String> = p
                .iter()
                .map(|path| path.to_string_lossy().to_string())
                .collect();
            Ok(FileSelection { paths: path_strings })
        }
        None => Ok(FileSelection { paths: vec![] }),
    }
}


// 系统相关命令
#[tauri::command]
pub async fn open_url(url: String) -> Result<(), CommandError> {
    use tauri::api::shell::open;
    open(&tauri::ShellScope::new(), &url, None).map_err(|e| CommandError::Automation(e.into()))
}

#[tauri::command]
pub async fn show_message(app: AppHandle, title: String, message: String) -> Result<(), CommandError> {
    use tauri::api::dialog::MessageDialogBuilder;
    let window = app.get_window("main").unwrap();
    MessageDialogBuilder::new(&title, &message).show(move |_| {});
    Ok(())
}