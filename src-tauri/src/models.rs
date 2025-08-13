use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Profile {
    pub id: Option<Uuid>,
    pub name: String,
    pub phone: String,
    pub email: String,
    pub id_card_number: String,
    pub id_card_files: Option<String>, // JSON string of file paths
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct IpAsset {
    pub id: Option<Uuid>,
    pub work_name: String,
    pub work_type: String,
    pub owner: String,
    pub region: String,
    pub work_start_date: String,
    pub work_end_date: String,
    pub equity_type: String,
    pub is_agent: bool,
    pub auth_start_date: Option<String>,
    pub auth_end_date: Option<String>,
    pub auth_files: Option<String>, // JSON string of file paths
    pub work_proof_files: Option<String>, // JSON string of file paths
    pub status: String,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Case {
    pub id: Option<Uuid>,
    pub infringing_url: String,
    pub original_url: Option<String>,
    pub associated_ip_id: Option<Uuid>,
    pub status: String,
    pub submission_date: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AutomationRequest {
    pub infringing_url: String,
    pub original_url: Option<String>,
    pub ip_asset_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AutomationStatus {
    pub is_running: bool,
    pub current_step: Option<String>,
    pub progress: Option<f32>,
    pub error: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileSelection {
    pub paths: Vec<String>,
}

impl Default for Profile {
    fn default() -> Self {
        Self {
            id: None,
            name: String::new(),
            phone: String::new(),
            email: String::new(),
            id_card_number: String::new(),
            id_card_files: None,
            created_at: None,
            updated_at: None,
        }
    }
}

impl Default for IpAsset {
    fn default() -> Self {
        Self {
            id: None,
            work_name: String::new(),
            work_type: String::new(),
            owner: String::new(),
            region: "中国大陆".to_string(),
            work_start_date: String::new(),
            work_end_date: String::new(),
            equity_type: "著作权".to_string(),
            is_agent: false,
            auth_start_date: None,
            auth_end_date: None,
            auth_files: None,
            work_proof_files: None,
            status: "待认证".to_string(),
            created_at: None,
            updated_at: None,
        }
    }
}

impl Default for Case {
    fn default() -> Self {
        Self {
            id: None,
            infringing_url: String::new(),
            original_url: None,
            associated_ip_id: None,
            status: "新建".to_string(),
            submission_date: None,
            created_at: None,
            updated_at: None,
        }
    }
}