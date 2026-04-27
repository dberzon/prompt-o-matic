use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager, State};
use tokio::io::AsyncWriteExt;
use tokio::sync::RwLock;

#[derive(Default)]
pub struct ModelManagerState {
  pub default_model: Option<String>,
  pub active_downloads: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelDescriptor {
  pub id: String,
  pub display_name: String,
  pub size: u64,
  pub sha256: String,
  pub url: String,
  pub min_ram_gb: u32,
  pub recommended_threads: u16,
  pub context_size: u32,
}

#[derive(Debug, Serialize)]
pub struct InstalledModel {
  pub id: String,
  pub path: String,
  pub size: u64,
}

#[derive(Debug, Serialize)]
pub struct DownloadResponse {
  pub download_id: String,
  pub model_id: String,
  pub path: String,
}

fn is_placeholder_sha(sha: &str) -> bool {
  let normalized = sha.trim().to_ascii_lowercase();
  normalized.is_empty()
    || normalized.contains("replace-with")
    || normalized.contains("placeholder")
    || normalized == "replace_me"
}

async fn load_registry(app: &AppHandle) -> Result<Vec<ModelDescriptor>, String> {
  let path = app
    .path()
    .resource_dir()
    .map_err(|e| format!("resource dir error: {e}"))?
    .join("resources")
    .join("models.json");
  let raw = tokio::fs::read_to_string(path)
    .await
    .map_err(|e| format!("models.json read error: {e}"))?;
  let models = serde_json::from_str::<Vec<ModelDescriptor>>(&raw)
    .map_err(|e| format!("models.json parse error: {e}"))?;
  for model in &models {
    if is_placeholder_sha(&model.sha256) {
      return Err(format!(
        "Model {} has placeholder sha256. Refusing unsafe runtime.",
        model.id
      ));
    }
  }
  Ok(models)
}

async fn models_dir(app: &AppHandle) -> Result<PathBuf, String> {
  let base = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("app_data_dir error: {e}"))?;
  let dir = base.join("models");
  tokio::fs::create_dir_all(&dir)
    .await
    .map_err(|e| format!("create models dir failed: {e}"))?;
  Ok(dir)
}

#[tauri::command]
pub async fn models_list_available(app: AppHandle) -> Result<Vec<ModelDescriptor>, String> {
  load_registry(&app).await
}

#[tauri::command]
pub async fn models_list_installed(app: AppHandle) -> Result<Vec<InstalledModel>, String> {
  let available = load_registry(&app).await?;
  let dir = models_dir(&app).await?;
  let mut out = Vec::new();
  for model in available {
    let p = dir.join(format!("{}.gguf", model.id));
    if let Ok(meta) = tokio::fs::metadata(&p).await {
      out.push(InstalledModel {
        id: model.id,
        path: p.to_string_lossy().to_string(),
        size: meta.len(),
      });
    }
  }
  Ok(out)
}

#[tauri::command]
pub async fn models_download_start(
  app: AppHandle,
  state: State<'_, Arc<RwLock<ModelManagerState>>>,
  model_id: String,
) -> Result<DownloadResponse, String> {
  let available = load_registry(&app).await?;
  let model = available
    .into_iter()
    .find(|m| m.id == model_id)
    .ok_or_else(|| format!("Unknown model id: {model_id}"))?;
  let dir = models_dir(&app).await?;
  let dst = dir.join(format!("{}.gguf", model.id));
  let part = dir.join(format!("{}.part", model.id));
  let download_id = format!("dl-{}-{}", model.id, rand::random::<u32>());

  {
    let mut guard = state.write().await;
    guard
      .active_downloads
      .insert(download_id.clone(), model.id.clone());
  }

  let client = reqwest::Client::new();
  let mut request = client.get(&model.url);
  let existing = tokio::fs::metadata(&part).await.ok().map(|m| m.len()).unwrap_or(0);
  if existing > 0 {
    request = request.header("Range", format!("bytes={existing}-"));
  }
  let response = request
    .send()
    .await
    .map_err(|e| format!("download request failed: {e}"))?;
  if !response.status().is_success() && response.status().as_u16() != 206 {
    return Err(format!("download failed with status {}", response.status()));
  }

  let mut file = tokio::fs::OpenOptions::new()
    .create(true)
    .append(true)
    .open(&part)
    .await
    .map_err(|e| format!("open part file failed: {e}"))?;

  let mut stream = response.bytes_stream();
  while let Some(chunk) = stream.next().await {
    let bytes = chunk.map_err(|e| format!("download chunk error: {e}"))?;
    file
      .write_all(&bytes)
      .await
      .map_err(|e| format!("write chunk failed: {e}"))?;
  }
  file.flush().await.map_err(|e| format!("flush failed: {e}"))?;
  tokio::fs::rename(part, &dst)
    .await
    .map_err(|e| format!("finalize download failed: {e}"))?;
  let verify = models_verify(app, model.id.clone()).await?;
  if !verify.ok {
    let _ = tokio::fs::remove_file(&dst).await;
    return Err(format!(
      "checksum mismatch after download for {}",
      model.id
    ));
  }

  Ok(DownloadResponse {
    download_id,
    model_id: model.id,
    path: dst.to_string_lossy().to_string(),
  })
}

#[tauri::command]
pub async fn models_download_cancel(
  state: State<'_, Arc<RwLock<ModelManagerState>>>,
  download_id: String,
) -> Result<bool, String> {
  let mut guard = state.write().await;
  Ok(guard.active_downloads.remove(&download_id).is_some())
}

#[derive(Debug, Serialize)]
pub struct VerifyResponse {
  pub model_id: String,
  pub ok: bool,
  pub actual_sha256: Option<String>,
}

#[tauri::command]
pub async fn models_verify(app: AppHandle, model_id: String) -> Result<VerifyResponse, String> {
  let available = load_registry(&app).await?;
  let model = available
    .into_iter()
    .find(|m| m.id == model_id)
    .ok_or_else(|| format!("Unknown model id: {model_id}"))?;
  let dir = models_dir(&app).await?;
  let path = dir.join(format!("{}.gguf", model.id));
  let bytes = tokio::fs::read(path)
    .await
    .map_err(|e| format!("read model failed: {e}"))?;
  let mut hasher = Sha256::new();
  hasher.update(bytes);
  let actual = format!("{:x}", hasher.finalize());
  let ok = actual.eq_ignore_ascii_case(&model.sha256);
  Ok(VerifyResponse {
    model_id: model.id,
    ok,
    actual_sha256: Some(actual),
  })
}

#[tauri::command]
pub async fn models_delete(app: AppHandle, model_id: String) -> Result<bool, String> {
  let dir = models_dir(&app).await?;
  let path = dir.join(format!("{}.gguf", model_id));
  if tokio::fs::metadata(&path).await.is_ok() {
    tokio::fs::remove_file(path)
      .await
      .map_err(|e| format!("delete failed: {e}"))?;
    return Ok(true);
  }
  Ok(false)
}

#[tauri::command]
pub async fn models_set_default(
  state: State<'_, Arc<RwLock<ModelManagerState>>>,
  model_id: String,
) -> Result<bool, String> {
  let mut guard = state.write().await;
  guard.default_model = Some(model_id);
  Ok(true)
}
