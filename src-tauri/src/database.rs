use sqlx::SqlitePool;
use uuid::Uuid;
use chrono::Utc;
use anyhow::Result;
use crate::models::{Profile, IpAsset, Case};

// Database path will be initialized at runtime
static mut DATABASE_URL: Option<String> = None;

fn get_database_url() -> Result<String> {
    unsafe {
        if let Some(ref url) = DATABASE_URL {
            return Ok(url.clone());
        }
    }
    
    // Use a simple relative path in the app directory for now
    // This will create the database in the app's working directory
    let db_url = "sqlite:rights_guard.db".to_string();
    
    unsafe {
        DATABASE_URL = Some(db_url.clone());
    }
    
    tracing::info!("Using database URL: {}", db_url);
    Ok(db_url)
}

pub async fn init_database() -> Result<()> {
    let database_url = get_database_url()?;
    let pool = SqlitePool::connect(&database_url).await?;
    
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

    Ok(())
}

pub async fn get_pool() -> Result<SqlitePool> {
    let database_url = get_database_url()?;
    Ok(SqlitePool::connect(&database_url).await?)
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
    let pool = get_pool().await?;
    let now = Utc::now();
    
    let profile_id = profile.id.unwrap_or_else(Uuid::new_v4);
    
    sqlx::query(
        r#"
        INSERT OR REPLACE INTO profiles (
            id, name, phone, email, id_card_number, id_card_files, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 
            COALESCE((SELECT created_at FROM profiles WHERE id = ?1), ?7), ?7)
        )
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
    .await?;

    let saved_profile = get_profile().await?;
    Ok(saved_profile.unwrap())
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
        )
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
        )
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