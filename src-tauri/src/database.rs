use sqlx::SqlitePool;
use uuid::Uuid;
use chrono::Utc;
use anyhow::{Result, Context};
use crate::models::{Profile, IpAsset, Case};
use std::path::PathBuf;
use std::fs;
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;
use tauri::Manager;

// Global database URL storage with thread safety
static DATABASE_URL: Lazy<Arc<Mutex<Option<String>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));

// Store app handle for path resolution
static APP_HANDLE: Lazy<Arc<Mutex<Option<tauri::AppHandle>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));

/// Initialize the database system with the app handle
/// This must be called once during app setup before any database operations
pub fn set_app_handle(handle: tauri::AppHandle) {
    let mut app_handle = APP_HANDLE.lock().unwrap();
    *app_handle = Some(handle);
    tracing::info!("App handle set for database path resolution");
}

/// Get the proper database path using Tauri's app data directory
/// This works consistently in both development and production builds
fn get_database_path() -> Result<PathBuf> {
    // First try to use Tauri's app data directory (preferred)
    if let Ok(app_handle_guard) = APP_HANDLE.lock() {
        if let Some(handle) = app_handle_guard.as_ref() {
            tracing::info!("Using Tauri app data directory for database path");
            
            let app_data_dir = handle.path().app_data_dir()
                .context("Failed to get app data directory")?;
            
            // Create the app data directory if it doesn't exist
            if !app_data_dir.exists() {
                fs::create_dir_all(&app_data_dir)
                    .with_context(|| format!("Failed to create app data directory: {:?}", app_data_dir))?;
                tracing::info!("Created app data directory: {:?}", app_data_dir);
            }
            
            // Create data subdirectory for organized storage
            let data_dir = app_data_dir.join("data");
            if !data_dir.exists() {
                fs::create_dir_all(&data_dir)
                    .with_context(|| format!("Failed to create data directory: {:?}", data_dir))?;
                tracing::info!("Created data directory: {:?}", data_dir);
            }
            
            let db_path = data_dir.join("rights_guard.db");
            tracing::info!("Database file path (app data): {:?}", db_path);
            return Ok(db_path);
        }
    }
    
    // Fallback to current directory method if app handle not available
    tracing::warn!("App handle not available, falling back to current directory method");
    let mut db_path = std::env::current_dir()
        .context("Failed to get current directory")?;
    
    // Create a data directory if it doesn't exist
    db_path.push("data");
    if !db_path.exists() {
        fs::create_dir_all(&db_path)
            .with_context(|| format!("Failed to create data directory: {:?}", db_path))?;
        tracing::info!("Created data directory (fallback): {:?}", db_path);
    }
    
    db_path.push("rights_guard.db");
    tracing::info!("Database file path (fallback): {:?}", db_path);
    
    Ok(db_path)
}

/// Get the database URL, initializing it if necessary
fn get_database_url() -> Result<String> {
    let mut url_guard = DATABASE_URL.lock().unwrap();
    
    if let Some(ref url) = *url_guard {
        return Ok(url.clone());
    }
    
    let db_path = get_database_path()
        .context("Failed to resolve database path")?;
    
    // Convert path to proper SQLite URL format for Windows
    let path_str = db_path.to_string_lossy().replace("\\", "/");
    let db_url = format!("sqlite:{}", path_str);
    
    // Additional path validation
    tracing::info!("Database file path: {:?}", db_path);
    tracing::info!("Database URL: {}", db_url);
    tracing::info!("Parent directory exists: {}", db_path.parent().map_or(false, |p| p.exists()));
    tracing::info!("Database file exists: {}", db_path.exists());
    
    // Ensure parent directory exists
    if let Some(parent_dir) = db_path.parent() {
        if !parent_dir.exists() {
            fs::create_dir_all(parent_dir)
                .with_context(|| format!("Failed to create parent directory: {:?}", parent_dir))?;
            tracing::info!("Created parent directory: {:?}", parent_dir);
        }
    }
    
    *url_guard = Some(db_url.clone());
    
    tracing::info!("Database URL initialized: {}", db_url);
    Ok(db_url)
}

/// Initialize the database with proper error handling and logging
/// This function creates all necessary tables and sets up the database schema
pub async fn init_database() -> Result<()> {
    tracing::info!("Starting database initialization...");
    
    let database_url = get_database_url()
        .context("Failed to determine database URL")?;
    
    tracing::info!("Attempting to connect to database: {}", database_url);
    
    // Try connecting with detailed error information
    let pool = match SqlitePool::connect(&database_url).await {
        Ok(pool) => {
            tracing::info!("Database connection established successfully");
            pool
        }
        Err(e) => {
            tracing::error!("SQLite connection failed. Error: {:?}", e);
            tracing::error!("Connection string was: {}", database_url);
            
            // Additional diagnostic information
            if let Ok(db_path) = get_database_path() {
                tracing::error!("Database file path: {:?}", db_path);
                tracing::error!("File exists: {}", db_path.exists());
                if let Some(parent) = db_path.parent() {
                    tracing::error!("Parent directory: {:?}", parent);
                    tracing::error!("Parent exists: {}", parent.exists());
                    tracing::error!("Parent permissions: {:?}", std::fs::metadata(parent));
                }
            }
            
            return Err(anyhow::anyhow!("Failed to connect to database: {}", e));
        }
    };
    
    tracing::info!("Database connection established successfully");
    
    // 创建个人档案表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT NOT NULL,
            id_card_number TEXT NOT NULL,
            id_card_files TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        "#,
    )
    .execute(&pool)
    .await?;

    // 创建IP资产表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS ip_assets (
            id TEXT PRIMARY KEY,
            work_name TEXT NOT NULL,
            work_type TEXT NOT NULL,
            owner TEXT NOT NULL,
            region TEXT NOT NULL,
            work_start_date TEXT NOT NULL,
            work_end_date TEXT NOT NULL,
            equity_type TEXT NOT NULL,
            is_agent INTEGER NOT NULL DEFAULT 0,
            auth_start_date TEXT,
            auth_end_date TEXT,
            auth_files TEXT,
            work_proof_files TEXT,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        "#,
    )
    .execute(&pool)
    .await?;

    // 创建案件表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS cases (
            id TEXT PRIMARY KEY,
            infringing_url TEXT NOT NULL,
            original_url TEXT,
            associated_ip_id TEXT,
            status TEXT NOT NULL,
            submission_date TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (associated_ip_id) REFERENCES ip_assets (id)
        )
        "#,
    )
    .execute(&pool)
    .await?;

    // 创建自动化状态表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS automation_status (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            is_running INTEGER NOT NULL DEFAULT 0,
            current_step TEXT,
            progress REAL,
            error TEXT,
            started_at TEXT,
            updated_at TEXT NOT NULL
        )
        "#,
    )
    .execute(&pool)
    .await?;

    // 初始化默认状态
    sqlx::query(
        r#"
        INSERT OR IGNORE INTO automation_status (id, is_running, updated_at)
        VALUES (1, 0, ?1)
        "#,
    )
    .bind(Utc::now().to_rfc3339())
    .execute(&pool)
    .await?;

    tracing::info!("Database initialization completed successfully");
    Ok(())
}

pub async fn get_pool() -> Result<SqlitePool> {
    let database_url = get_database_url()
        .context("Failed to determine database URL for pool creation")?;
    
    tracing::debug!("Creating new database pool for: {}", database_url);
    
    SqlitePool::connect(&database_url).await
        .with_context(|| format!("Failed to create database pool: {}", database_url))
}

// 个人档案相关操作
pub async fn get_profile() -> Result<Option<Profile>> {
    let pool = get_pool().await?;
    let profile = sqlx::query_as::<_, Profile>(
        "SELECT * FROM profiles ORDER BY created_at DESC LIMIT 1"
    )
    .fetch_optional(&pool)
    .await?;
    Ok(profile)
}

pub async fn save_profile(profile: &Profile) -> Result<Profile> {
    tracing::info!("Starting save_profile for: {}", profile.name);
    tracing::debug!("Profile data - name: {}, email: {}, phone: {}", profile.name, profile.email, profile.phone);
    
    let pool = get_pool().await.map_err(|e| {
        tracing::error!("Failed to get database pool: {:?}", e);
        e
    })?;
    
    let now = Utc::now();
    let profile_id = profile.id.unwrap_or_else(Uuid::new_v4);
    
    tracing::info!("Using profile ID: {}", profile_id);
    tracing::info!("Timestamp: {}", now.to_rfc3339());
    
    // First check if profile exists
    let existing = sqlx::query("SELECT id FROM profiles WHERE id = ?1")
        .bind(profile_id.to_string())
        .fetch_optional(&pool)
        .await?;
        
    let is_update = existing.is_some();
    tracing::info!("Profile exists: {}, performing {}", is_update, if is_update { "UPDATE" } else { "INSERT" });
    
    let result = sqlx::query(
        r#"
        INSERT OR REPLACE INTO profiles (
            id, name, phone, email, id_card_number, id_card_files, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 
            COALESCE((SELECT created_at FROM profiles WHERE id = ?1), ?7), ?7)
        "#,
    )
    .bind(profile_id.to_string())
    .bind(&profile.name)
    .bind(&profile.phone)
    .bind(&profile.email)
    .bind(&profile.id_card_number)
    .bind(&profile.id_card_files)
    .bind(now.to_rfc3339())
    .execute(&pool)
    .await;
    
    match result {
        Ok(exec_result) => {
            tracing::info!("Database operation successful. Rows affected: {}", exec_result.rows_affected());
            
            if exec_result.rows_affected() == 0 {
                tracing::warn!("No rows were affected by the operation");
            }
        }
        Err(e) => {
            tracing::error!("Database INSERT/UPDATE failed: {:?}", e);
            tracing::error!("SQL Error details: {}", e);
            return Err(anyhow::anyhow!("Database operation failed: {}", e));
        }
    }

    tracing::info!("Retrieving saved profile by ID: {}", profile_id);
    
    // Directly query by ID instead of getting the latest
    let saved_profile = sqlx::query_as::<_, Profile>("SELECT * FROM profiles WHERE id = ?1")
        .bind(profile_id.to_string())
        .fetch_optional(&pool)
        .await?;
        
    match saved_profile {
        Some(profile) => {
            tracing::info!("Profile retrieved successfully: {} (ID: {:?})", profile.name, profile.id);
            Ok(profile)
        }
        None => {
            tracing::error!("Failed to retrieve saved profile with ID: {}", profile_id);
            
            // List all profiles for debugging
            let all_profiles = sqlx::query_as::<_, (String, String)>("SELECT id, name FROM profiles")
                .fetch_all(&pool)
                .await?;
            tracing::info!("All profiles in database: {}", 
                all_profiles.iter()
                    .map(|(id, name)| format!("ID: {}, Name: {}", id, name))
                    .collect::<Vec<_>>()
                    .join(", "));
            
            Err(anyhow::anyhow!("Profile was saved but could not be retrieved"))
        }
    }
}

// IP资产相关操作
pub async fn get_ip_assets() -> Result<Vec<IpAsset>> {
    let pool = get_pool().await?;
    let assets = sqlx::query_as::<_, IpAsset>(
        "SELECT * FROM ip_assets ORDER BY created_at DESC"
    )
    .fetch_all(&pool)
    .await?;
    Ok(assets)
}

pub async fn get_ip_asset(id: Uuid) -> Result<Option<IpAsset>> {
    let pool = get_pool().await?;
    let asset = sqlx::query_as::<_, IpAsset>(
        "SELECT * FROM ip_assets WHERE id = ?1"
    )
    .bind(id.to_string())
    .fetch_optional(&pool)
    .await?;
    Ok(asset)
}

pub async fn save_ip_asset(asset: &IpAsset) -> Result<IpAsset> {
    let pool = get_pool().await?;
    let now = Utc::now();
    
    let asset_id = asset.id.unwrap_or_else(Uuid::new_v4);
    
    sqlx::query(
        r#"
        INSERT OR REPLACE INTO ip_assets (
            id, work_name, work_type, owner, region, work_start_date, work_end_date,
            equity_type, is_agent, auth_start_date, auth_end_date, auth_files,
            work_proof_files, status, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14,
            COALESCE((SELECT created_at FROM ip_assets WHERE id = ?1), ?15), ?15)
        "#,
    )
    .bind(asset_id.to_string())
    .bind(&asset.work_name)
    .bind(&asset.work_type)
    .bind(&asset.owner)
    .bind(&asset.region)
    .bind(&asset.work_start_date)
    .bind(&asset.work_end_date)
    .bind(&asset.equity_type)
    .bind(asset.is_agent)
    .bind(&asset.auth_start_date)
    .bind(&asset.auth_end_date)
    .bind(&asset.auth_files)
    .bind(&asset.work_proof_files)
    .bind(&asset.status)
    .bind(now.to_rfc3339())
    .execute(&pool)
    .await?;

    let saved_asset = get_ip_asset(asset_id).await?;
    Ok(saved_asset.unwrap())
}

pub async fn delete_ip_asset(id: Uuid) -> Result<bool> {
    let pool = get_pool().await?;
    let result = sqlx::query(
        "DELETE FROM ip_assets WHERE id = ?1"
    )
    .bind(id.to_string())
    .execute(&pool)
    .await?;
    
    Ok(result.rows_affected() > 0)
}

// 案件相关操作
pub async fn get_cases() -> Result<Vec<Case>> {
    let pool = get_pool().await?;
    let cases = sqlx::query_as::<_, Case>(
        r#"
        SELECT c.*, ia.work_name as associated_ip_name
        FROM cases c
        LEFT JOIN ip_assets ia ON c.associated_ip_id = ia.id
        ORDER BY c.created_at DESC
        "#,
    )
    .fetch_all(&pool)
    .await?;
    Ok(cases)
}

pub async fn save_case(case: &Case) -> Result<Case> {
    let pool = get_pool().await?;
    let now = Utc::now();
    
    let case_id = case.id.unwrap_or_else(Uuid::new_v4);
    
    sqlx::query(
        r#"
        INSERT OR REPLACE INTO cases (
            id, infringing_url, original_url, associated_ip_id, status,
            submission_date, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6,
            COALESCE((SELECT created_at FROM cases WHERE id = ?1), ?7), ?7)
        "#,
    )
    .bind(case_id.to_string())
    .bind(&case.infringing_url)
    .bind(&case.original_url)
    .bind(&case.associated_ip_id.map(|id| id.to_string()))
    .bind(&case.status)
    .bind(&case.submission_date.map(|dt| dt.to_rfc3339()))
    .bind(now.to_rfc3339())
    .execute(&pool)
    .await?;

    let saved_case = sqlx::query_as::<_, Case>(
        "SELECT * FROM cases WHERE id = ?1"
    )
    .bind(case_id.to_string())
    .fetch_one(&pool)
    .await?;
    
    Ok(saved_case)
}

pub async fn delete_case(id: Uuid) -> Result<bool> {
    let pool = get_pool().await?;
    let result = sqlx::query(
        "DELETE FROM cases WHERE id = ?1"
    )
    .bind(id.to_string())
    .execute(&pool)
    .await?;
    
    Ok(result.rows_affected() > 0)
}

/// Clear the cached database URL to force path re-resolution
/// Useful for testing or if the app data directory changes
pub fn clear_database_cache() {
    let mut url_guard = DATABASE_URL.lock().unwrap();
    *url_guard = None;
    tracing::info!("Database URL cache cleared");
}

/// Get diagnostic information about the database configuration
/// Returns detailed information about paths and connection status
pub async fn get_database_info() -> Result<String> {
    let mut info = Vec::new();
    
    // App handle status - scope the mutex guard
    let app_handle_exists = {
        let app_handle = APP_HANDLE.lock().unwrap();
        app_handle.is_some()
    }; // Mutex guard is dropped here
    
    if app_handle_exists {
        info.push("✓ App handle initialized".to_string());
    } else {
        info.push("✗ App handle not initialized".to_string());
        return Ok(info.join("\n"));
    }
    
    // Database path resolution
    match get_database_path() {
        Ok(path) => {
            info.push(format!("✓ Database path: {:?}", path));
            info.push(format!("✓ Path exists: {}", path.exists()));
            
            if let Some(parent) = path.parent() {
                info.push(format!("✓ Parent directory: {:?}", parent));
                info.push(format!("✓ Parent exists: {}", parent.exists()));
            }
        }
        Err(e) => {
            info.push(format!("✗ Failed to resolve database path: {}", e));
        }
    }
    
    // Database URL
    match get_database_url() {
        Ok(url) => {
            info.push(format!("✓ Database URL: {}", url));
        }
        Err(e) => {
            info.push(format!("✗ Failed to get database URL: {}", e));
        }
    }
    
    // Connection test - now safe to await since no guards are held
    match get_pool().await {
        Ok(_pool) => {
            info.push("✓ Database connection successful".to_string());
        }
        Err(e) => {
            info.push(format!("✗ Database connection failed: {}", e));
        }
    }
    
    Ok(info.join("\n"))
}