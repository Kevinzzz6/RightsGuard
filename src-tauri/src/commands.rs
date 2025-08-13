use tauri::{Manager, State};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use anyhow::Result;
use crate::database;
use crate::automation;
use crate::models::{Profile, IpAsset, Case, AutomationRequest, FileSelection};

// 个人档案相关命令
#[tauri::command]
pub async fn get_profile() -> Result<Option<Profile>> {
    database::get_profile().await
}

#[tauri::command]
pub async fn save_profile(profile: Profile) -> Result<Profile> {
    database::save_profile(&profile).await
}

// IP资产相关命令
#[tauri::command]
pub async fn get_ip_assets() -> Result<Vec<IpAsset>> {
    database::get_ip_assets().await
}

#[tauri::command]
pub async fn get_ip_asset(id: String) -> Result<Option<IpAsset>> {
    let uuid = Uuid::parse_str(&id)?;
    database::get_ip_asset(uuid).await
}

#[tauri::command]
pub async fn save_ip_asset(asset: IpAsset) -> Result<IpAsset> {
    database::save_ip_asset(&asset).await
}

#[tauri::command]
pub async fn delete_ip_asset(id: String) -> Result<bool> {
    let uuid = Uuid::parse_str(&id)?;
    database::delete_ip_asset(uuid).await
}

// 案件相关命令
#[tauri::command]
pub async fn get_cases() -> Result<Vec<Case>> {
    database::get_cases().await
}

#[tauri::command]
pub async fn save_case(case: Case) -> Result<Case> {
    database::save_case(&case).await
}

#[tauri::command]
pub async fn delete_case(id: String) -> Result<bool> {
    let uuid = Uuid::parse_str(&id)?;
    database::delete_case(uuid).await
}

// 自动化相关命令
#[tauri::command]
pub async fn start_automation(
    infringing_url: String,
    original_url: Option<String>,
    ip_asset_id: Option<String>,
) -> Result<()> {
    let ip_asset_uuid = ip_asset_id.map(|id| Uuid::parse_str(&id)).transpose()?;
    
    let request = AutomationRequest {
        infringing_url,
        original_url,
        ip_asset_id: ip_asset_uuid,
    };
    
    automation::start_automation(request).await
}

#[tauri::command]
pub async fn stop_automation() -> Result<()> {
    automation::stop_automation().await
}

#[tauri::command]
pub async fn get_automation_status() -> Result<crate::models::AutomationStatus> {
    automation::get_automation_status().await
}

// 文件相关命令
#[tauri::command]
pub async fn select_file(app: tauri::AppHandle) -> Result<FileSelection> {
    use tauri::dialog::{FileDialogBuilder, MessageDialogKind};
    
    let file_path = FileDialogBuilder::new()
        .set_title("选择文件")
        .pick_file();
    
    match file_path {
        Some(path) => Ok(FileSelection {
            paths: vec![path.to_string_lossy().to_string()],
        }),
        None => Ok(FileSelection { paths: vec![] }),
    }
}

#[tauri::command]
pub async fn select_files(app: tauri::AppHandle) -> Result<FileSelection> {
    use tauri::dialog::{FileDialogBuilder, MessageDialogKind};
    
    let file_paths = FileDialogBuilder::new()
        .set_title("选择文件")
        .pick_files();
    
    match file_paths {
        Some(paths) => {
            let path_strings: Vec<String> = paths
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
pub async fn open_url(url: String) -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(&["/c", "start", "", &url])
            .spawn()?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn show_message(
    app: tauri::AppHandle,
    title: String,
    message: String,
) -> Result<()> {
    use tauri::dialog::{MessageDialogBuilder, MessageDialogKind};
    
    MessageDialogBuilder::new(&app, &title, &message)
        .kind(MessageDialogKind::Info)
        .show();
    
    Ok(())
}