use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Row, Error as SqlxError};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::str::FromStr;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Profile {
    pub id: Option<Uuid>,
    pub name: String,
    pub phone: String,
    pub email: String,
    #[serde(rename = "idCardNumber")]
    pub id_card_number: String,
    #[serde(rename = "idCardFiles")]
    pub id_card_files: Option<String>, // JSON string of file paths
    #[serde(rename = "createdAt")]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IpAsset {
    pub id: Option<Uuid>,
    #[serde(rename = "workName")]
    pub work_name: String,
    #[serde(rename = "workType")]
    pub work_type: String,
    pub owner: String,
    pub region: String,
    #[serde(rename = "workStartDate")]
    pub work_start_date: String,
    #[serde(rename = "workEndDate")]
    pub work_end_date: String,
    #[serde(rename = "equityType")]
    pub equity_type: String,
    #[serde(rename = "isAgent")]
    pub is_agent: bool,
    #[serde(rename = "authStartDate")]
    pub auth_start_date: Option<String>,
    #[serde(rename = "authEndDate")]
    pub auth_end_date: Option<String>,
    #[serde(rename = "authFiles")]
    pub auth_files: Option<String>, // JSON string of file paths
    #[serde(rename = "workProofFiles")]
    pub work_proof_files: Option<String>, // JSON string of file paths
    pub status: String,
    #[serde(rename = "createdAt")]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Case {
    pub id: Option<Uuid>,
    #[serde(rename = "infringingUrl")]
    pub infringing_url: String,
    #[serde(rename = "originalUrl")]
    pub original_url: Option<String>,
    #[serde(rename = "associatedIpId")]
    pub associated_ip_id: Option<Uuid>,
    pub status: String,
    #[serde(rename = "submissionDate")]
    pub submission_date: Option<DateTime<Utc>>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(rename = "updatedAt")]
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
    #[serde(rename = "isRunning")]
    pub is_running: bool,
    #[serde(rename = "currentStep")]
    pub current_step: Option<String>,
    pub progress: Option<f32>,
    pub error: Option<String>,
    #[serde(rename = "startedAt")]
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

// Custom FromRow implementations to handle DateTime parsing
impl<'r> FromRow<'r, sqlx::sqlite::SqliteRow> for Profile {
    fn from_row(row: &'r sqlx::sqlite::SqliteRow) -> Result<Self, SqlxError> {
        let parse_datetime = |col: &str| -> Result<Option<DateTime<Utc>>, SqlxError> {
            let value: Option<String> = row.try_get(col)?;
            match value {
                Some(s) => DateTime::parse_from_rfc3339(&s)
                    .map(|dt| Some(dt.with_timezone(&Utc)))
                    .map_err(|e| SqlxError::ColumnDecode {
                        index: col.to_string(),
                        source: Box::new(e),
                    }),
                None => Ok(None),
            }
        };

        let id_str: Option<String> = row.try_get("id")?;
        let id = match id_str {
            Some(s) => Some(Uuid::from_str(&s).map_err(|e| SqlxError::ColumnDecode {
                index: "id".to_string(),
                source: Box::new(e),
            })?),
            None => None,
        };

        Ok(Profile {
            id,
            name: row.try_get("name")?,
            phone: row.try_get("phone")?,
            email: row.try_get("email")?,
            id_card_number: row.try_get("id_card_number")?,
            id_card_files: row.try_get("id_card_files")?,
            created_at: parse_datetime("created_at")?,
            updated_at: parse_datetime("updated_at")?,
        })
    }
}

impl<'r> FromRow<'r, sqlx::sqlite::SqliteRow> for IpAsset {
    fn from_row(row: &'r sqlx::sqlite::SqliteRow) -> Result<Self, SqlxError> {
        let parse_datetime = |col: &str| -> Result<Option<DateTime<Utc>>, SqlxError> {
            let value: Option<String> = row.try_get(col)?;
            match value {
                Some(s) => DateTime::parse_from_rfc3339(&s)
                    .map(|dt| Some(dt.with_timezone(&Utc)))
                    .map_err(|e| SqlxError::ColumnDecode {
                        index: col.to_string(),
                        source: Box::new(e),
                    }),
                None => Ok(None),
            }
        };

        let id_str: Option<String> = row.try_get("id")?;
        let id = match id_str {
            Some(s) => Some(Uuid::from_str(&s).map_err(|e| SqlxError::ColumnDecode {
                index: "id".to_string(),
                source: Box::new(e),
            })?),
            None => None,
        };

        Ok(IpAsset {
            id,
            work_name: row.try_get("work_name")?,
            work_type: row.try_get("work_type")?,
            owner: row.try_get("owner")?,
            region: row.try_get("region")?,
            work_start_date: row.try_get("work_start_date")?,
            work_end_date: row.try_get("work_end_date")?,
            equity_type: row.try_get("equity_type")?,
            is_agent: row.try_get("is_agent")?,
            auth_start_date: row.try_get("auth_start_date")?,
            auth_end_date: row.try_get("auth_end_date")?,
            auth_files: row.try_get("auth_files")?,
            work_proof_files: row.try_get("work_proof_files")?,
            status: row.try_get("status")?,
            created_at: parse_datetime("created_at")?,
            updated_at: parse_datetime("updated_at")?,
        })
    }
}

impl<'r> FromRow<'r, sqlx::sqlite::SqliteRow> for Case {
    fn from_row(row: &'r sqlx::sqlite::SqliteRow) -> Result<Self, SqlxError> {
        let parse_datetime = |col: &str| -> Result<Option<DateTime<Utc>>, SqlxError> {
            let value: Option<String> = row.try_get(col)?;
            match value {
                Some(s) => DateTime::parse_from_rfc3339(&s)
                    .map(|dt| Some(dt.with_timezone(&Utc)))
                    .map_err(|e| SqlxError::ColumnDecode {
                        index: col.to_string(),
                        source: Box::new(e),
                    }),
                None => Ok(None),
            }
        };

        let id_str: Option<String> = row.try_get("id")?;
        let id = match id_str {
            Some(s) => Some(Uuid::from_str(&s).map_err(|e| SqlxError::ColumnDecode {
                index: "id".to_string(),
                source: Box::new(e),
            })?),
            None => None,
        };

        let associated_ip_id_str: Option<String> = row.try_get("associated_ip_id")?;
        let associated_ip_id = match associated_ip_id_str {
            Some(s) => Some(Uuid::from_str(&s).map_err(|e| SqlxError::ColumnDecode {
                index: "associated_ip_id".to_string(),
                source: Box::new(e),
            })?),
            None => None,
        };

        Ok(Case {
            id,
            infringing_url: row.try_get("infringing_url")?,
            original_url: row.try_get("original_url")?,
            associated_ip_id,
            status: row.try_get("status")?,
            submission_date: parse_datetime("submission_date")?,
            created_at: parse_datetime("created_at")?,
            updated_at: parse_datetime("updated_at")?,
        })
    }
}