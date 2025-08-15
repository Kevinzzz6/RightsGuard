use serde::Serialize;
use uuid::Uuid;
use crate::database;
use crate::automation;
use crate::models::{Profile, IpAsset, Case, AutomationRequest, FileSelection, AutomationStatus};
use std::path::PathBuf;
use std::fs;
use std::str::FromStr;

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
    tracing::info!("Attempting to save profile: {}", profile.name);
    
    match database::save_profile(&profile).await {
        Ok(saved_profile) => {
            tracing::info!("Profile saved successfully: {:?}", saved_profile.id);
            Ok(saved_profile)
        }
        Err(e) => {
            tracing::error!("Failed to save profile: {}", e);
            Err(CommandError::Database(e.to_string()))
        }
    }
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
        Ok(Some(path)) => vec![path.to_string()],
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
        Ok(Some(paths)) => paths.into_iter().map(|path| path.to_string()).collect(),
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

// Helper function to test file system operations
async fn test_file_system_operations() -> Result<Vec<String>, anyhow::Error> {
    let mut results = Vec::new();
    
    // Test app data directory access
    if let Ok(app_handle_guard) = database::APP_HANDLE.lock() {
        if let Some(handle) = app_handle_guard.as_ref() {
            let app_data_dir = handle.path().app_data_dir()
                .map_err(|e| anyhow::anyhow!("Failed to get app data directory: {}", e))?;
            
            results.push(format!("✓ App data directory: {:?}", app_data_dir));
            results.push(format!("✓ App data exists: {}", app_data_dir.exists()));
            
            // Test creating the data subdirectory
            let data_dir = app_data_dir.join("data");
            if !data_dir.exists() {
                fs::create_dir_all(&data_dir)
                    .map_err(|e| anyhow::anyhow!("Failed to create data directory: {}", e))?;
                results.push(format!("✓ Created data directory: {:?}", data_dir));
            } else {
                results.push(format!("✓ Data directory exists: {:?}", data_dir));
            }
            
            // Test write permissions
            let test_file = data_dir.join("write_test.tmp");
            match fs::write(&test_file, "test content") {
                Ok(_) => {
                    results.push("✓ Write permission test passed".to_string());
                    let _ = fs::remove_file(&test_file); // Clean up
                }
                Err(e) => {
                    results.push(format!("✗ Write permission test failed: {}", e));
                }
            }
            
            // Test database file path
            let db_file = data_dir.join("rights_guard.db");
            results.push(format!("✓ Database file path: {:?}", db_file));
            
            // Check if database file exists and get its size
            if db_file.exists() {
                match fs::metadata(&db_file) {
                    Ok(metadata) => {
                        results.push(format!("✓ Database file size: {} bytes", metadata.len()));
                        results.push(format!("✓ Database file readonly: {}", metadata.permissions().readonly()));
                    }
                    Err(e) => {
                        results.push(format!("✗ Failed to get database metadata: {}", e));
                    }
                }
            } else {
                results.push("ℹ Database file does not exist yet".to_string());
            }
        } else {
            return Err(anyhow::anyhow!("App handle not available"));
        }
    } else {
        return Err(anyhow::anyhow!("Failed to access app handle"));
    }
    
    Ok(results)
}

// Database test command with enhanced Windows compatibility testing
#[tauri::command]
pub async fn test_database() -> Result<String, CommandError> {
    tracing::info!("Starting comprehensive database test with Windows compatibility checks");
    let mut results = Vec::new();
    
    // Step 0: Test file system operations
    tracing::info!("Step 0: Testing file system operations...");
    match test_file_system_operations().await {
        Ok(fs_results) => {
            results.extend(fs_results);
        }
        Err(e) => {
            let error_msg = format!("✗ File system test failed: {}", e);
            tracing::error!("{}", error_msg);
            results.push(error_msg);
            return Ok(results.join("\n"));
        }
    }
    
    // Step 1: Test database initialization
    tracing::info!("Step 1: Testing database initialization...");
    match database::init_database().await {
        Ok(()) => {
            results.push("✓ Database initialization successful".to_string());
            tracing::info!("Database initialization test passed");
        }
        Err(e) => {
            let error_msg = format!("✗ Database initialization failed: {}", e);
            tracing::error!("{}", error_msg);
            results.push(error_msg);
            // Continue with other tests to gather more information
        }
    }
    
    // Step 2: Test database connection
    tracing::info!("Step 2: Testing database connection...");
    let pool = match database::get_pool().await {
        Ok(pool) => {
            results.push("✓ Database connection successful".to_string());
            tracing::info!("Database connection test passed");
            pool
        }
        Err(e) => {
            let error_msg = format!("✗ Database connection failed: {}", e);
            tracing::error!("{}", error_msg);
            results.push(error_msg);
            return Ok(results.join("\n"));
        }
    };
    
    // Step 3: Test basic query
    tracing::info!("Step 3: Testing basic database query...");
    match sqlx::query("SELECT 1").fetch_one(&pool).await {
        Ok(_) => {
            results.push("✓ Basic query successful".to_string());
            tracing::info!("Basic query test passed");
        }
        Err(e) => {
            let error_msg = format!("✗ Basic query failed: {}", e);
            tracing::error!("{}", error_msg);
            results.push(error_msg);
            return Ok(results.join("\n"));
        }
    }
    
    // Step 4: Test table existence
    tracing::info!("Step 4: Testing table existence...");
    match sqlx::query("SELECT name FROM sqlite_master WHERE type='table' AND name='profiles'")
        .fetch_optional(&pool)
        .await
    {
        Ok(Some(_)) => {
            results.push("✓ Profiles table exists".to_string());
            tracing::info!("Profiles table exists");
        }
        Ok(None) => {
            let error_msg = "✗ Profiles table does not exist".to_string();
            tracing::error!("{}", error_msg);
            results.push(error_msg);
            return Ok(results.join("\n"));
        }
        Err(e) => {
            let error_msg = format!("✗ Table check failed: {}", e);
            tracing::error!("{}", error_msg);
            results.push(error_msg);
            return Ok(results.join("\n"));
        }
    }
    
    // Step 5: Test profile save with minimal data
    tracing::info!("Step 5: Testing profile save operation...");
    let test_profile = Profile {
        id: None,
        name: "Test User".to_string(),
        phone: "13800138000".to_string(),
        email: "test@example.com".to_string(),
        id_card_number: "110101199001011234".to_string(),
        id_card_files: None,
        created_at: None,
        updated_at: None,
    };
    
    match database::save_profile(&test_profile).await {
        Ok(saved) => {
            results.push(format!("✓ Profile save successful (ID: {:?})", saved.id));
            tracing::info!("Test profile saved successfully with ID: {:?}", saved.id);
        }
        Err(e) => {
            let error_msg = format!("✗ Profile save failed: {}", e);
            tracing::error!("{}", error_msg);
            results.push(error_msg);
            return Ok(results.join("\n"));
        }
    }
    
    // Step 6: Test profile retrieval
    tracing::info!("Step 6: Testing profile retrieval...");
    match database::get_profile().await {
        Ok(Some(profile)) => {
            results.push(format!("✓ Profile retrieval successful (Name: {})", profile.name));
            tracing::info!("Profile retrieval successful: {}", profile.name);
        }
        Ok(None) => {
            let error_msg = "✗ No profile found after save".to_string();
            tracing::error!("{}", error_msg);
            results.push(error_msg);
        }
        Err(e) => {
            let error_msg = format!("✗ Profile retrieval failed: {}", e);
            tracing::error!("{}", error_msg);
            results.push(error_msg);
        }
    }
    
    results.push("".to_string());
    results.push("🎉 Database test completed!".to_string());
    Ok(results.join("\n"))
}

// Comprehensive SQLite connection test command
#[tauri::command]
pub async fn test_sqlite_connection_strategies() -> Result<String, CommandError> {
    tracing::info!("Testing all SQLite connection strategies");
    let mut results = Vec::new();
    
    // Get the database path
    let db_path = match database::get_database_path() {
        Ok(path) => {
            results.push(format!("✓ Database path resolved: {:?}", path));
            path
        }
        Err(e) => {
            let error_msg = format!("✗ Failed to resolve database path: {}", e);
            results.push(error_msg);
            return Ok(results.join("\n"));
        }
    };
    
    // Test 1: File creation
    results.push("\n--- Testing File Operations ---".to_string());
    match std::fs::File::create(&db_path) {
        Ok(_) => {
            results.push("✓ Database file creation successful".to_string());
        }
        Err(e) => {
            results.push(format!("✗ Database file creation failed: {}", e));
        }
    }
    
    // Test 2: Primary connection method
    results.push("\n--- Testing Primary Connection Method ---".to_string());
    match database::create_sqlite_options(&db_path) {
        Ok(options) => {
            results.push("✓ Primary SQLite options created".to_string());
            match sqlx::SqlitePool::connect_with(options).await {
                Ok(_pool) => {
                    results.push("✓ Primary connection successful".to_string());
                }
                Err(e) => {
                    results.push(format!("✗ Primary connection failed: {}", e));
                }
            }
        }
        Err(e) => {
            results.push(format!("✗ Primary options creation failed: {}", e));
        }
    }
    
    // Test 3: Fallback strategies
    results.push("\n--- Testing Fallback Strategies ---".to_string());
    
    // Strategy 1: Minimal options
    let simple_options = sqlx::sqlite::SqliteConnectOptions::from_str(&db_path.to_string_lossy())
        .map_err(|e| CommandError::Database(e.to_string()))?
        .create_if_missing(true);
    
    match sqlx::SqlitePool::connect_with(simple_options).await {
        Ok(_pool) => {
            results.push("✓ Fallback strategy 1 (minimal) successful".to_string());
        }
        Err(e) => {
            results.push(format!("✗ Fallback strategy 1 failed: {}", e));
        }
    }
    
    // Strategy 2: URI format
    let uri_path = if cfg!(windows) {
        format!("file:///{}?cache=shared&mode=rwc", db_path.to_string_lossy().replace("\\", "/"))
    } else {
        format!("file://{}?cache=shared&mode=rwc", db_path.to_string_lossy())
    };
    
    match sqlx::sqlite::SqliteConnectOptions::from_str(&uri_path) {
        Ok(uri_options) => {
            match sqlx::SqlitePool::connect_with(uri_options).await {
                Ok(_pool) => {
                    results.push("✓ Fallback strategy 2 (URI) successful".to_string());
                }
                Err(e) => {
                    results.push(format!("✗ Fallback strategy 2 failed: {}", e));
                }
            }
        }
        Err(e) => {
            results.push(format!("✗ URI options creation failed: {}", e));
        }
    }
    
    // Strategy 3: Legacy connection string
    let legacy_url = format!("sqlite:{}", db_path.to_string_lossy());
    match sqlx::SqlitePool::connect(&legacy_url).await {
        Ok(_pool) => {
            results.push("✓ Fallback strategy 3 (legacy) successful".to_string());
        }
        Err(e) => {
            results.push(format!("✗ Fallback strategy 3 failed: {}", e));
        }
    }
    
    // Test 4: In-memory fallback
    results.push("\n--- Testing In-Memory Fallback ---".to_string());
    let memory_options = sqlx::sqlite::SqliteConnectOptions::from_str("sqlite::memory:")
        .map_err(|e| CommandError::Database(e.to_string()))?
        .create_if_missing(true);
    
    match sqlx::SqlitePool::connect_with(memory_options).await {
        Ok(_pool) => {
            results.push("✓ In-memory database connection successful".to_string());
        }
        Err(e) => {
            results.push(format!("✗ In-memory connection failed: {}", e));
        }
    }
    
    results.push("\n🔍 SQLite connection strategy test completed!".to_string());
    Ok(results.join("\n"))
}

// Database diagnostic command
#[tauri::command]
pub async fn get_database_diagnostics() -> Result<String, CommandError> {
    tracing::info!("Getting database diagnostic information");
    
    match database::get_database_info().await {
        Ok(info) => {
            tracing::info!("Database diagnostics retrieved successfully");
            Ok(info)
        }
        Err(e) => {
            tracing::error!("Failed to get database diagnostics: {}", e);
            Err(CommandError::Database(format!("Diagnostic failed: {}", e)))
        }
    }
}

// Clear database cache command
#[tauri::command]
pub async fn clear_database_cache() -> Result<String, CommandError> {
    tracing::info!("Clearing database cache");
    database::clear_database_cache();
    Ok("Database cache cleared successfully".to_string())
}