use std::sync::Arc;
use std::time::{Duration, Instant};

use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use tokio::process::{Child, Command};
use tokio::sync::RwLock;

#[derive(Default)]
pub struct SidecarState {
  pub running: bool,
  pub port: Option<u16>,
  pub model_path: Option<String>,
  pub secret: Option<String>,
  pub started_at_unix_ms: Option<u128>,
  pub last_error: Option<String>,
  pub child: Option<Child>,
}

#[derive(Debug, Deserialize)]
pub struct SidecarStartArgs {
  pub model_path: String,
  pub port: Option<u16>,
  pub threads: Option<u16>,
  pub ctx_size: Option<u32>,
  pub n_gpu_layers: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct SidecarStatus {
  pub running: bool,
  pub port: Option<u16>,
  pub model_path: Option<String>,
  pub secret: Option<String>,
  pub started_at_unix_ms: Option<u128>,
  pub last_error: Option<String>,
}

fn detect_binary_name() -> &'static str {
  #[cfg(target_os = "windows")]
  {
    "llama-server-x86_64-pc-windows-msvc.exe"
  }
  #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
  {
    "llama-server-aarch64-apple-darwin"
  }
  #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
  {
    "llama-server-x86_64-apple-darwin"
  }
  #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
  {
    "llama-server-x86_64-unknown-linux-gnu"
  }
}

fn is_placeholder_binary(path: &std::path::Path) -> bool {
  if !path.exists() {
    return true;
  }
  if let Ok(bytes) = std::fs::read(path) {
    let text = String::from_utf8_lossy(&bytes);
    return text.contains("PLACEHOLDER_BINARY_REPLACE_BEFORE_RELEASE");
  }
  false
}

async fn wait_for_health(port: u16, secret: &str, timeout: Duration) -> Result<(), String> {
  let client = reqwest::Client::new();
  let start = Instant::now();
  let url = format!("http://127.0.0.1:{port}/health");
  loop {
    let resp = client
      .get(&url)
      .header("x-qpb-sidecar-secret", secret)
      .send()
      .await;
    if let Ok(ok) = resp {
      if ok.status().is_success() {
        return Ok(());
      }
    }
    if start.elapsed() > timeout {
      return Err("Sidecar health timeout".to_string());
    }
    tokio::time::sleep(Duration::from_millis(300)).await;
  }
}

fn generate_secret() -> String {
  rand::thread_rng()
    .sample_iter(&Alphanumeric)
    .take(40)
    .map(char::from)
    .collect()
}

#[tauri::command]
pub async fn sidecar_start(
  app: AppHandle,
  state: State<'_, Arc<RwLock<SidecarState>>>,
  args: SidecarStartArgs,
) -> Result<SidecarStatus, String> {
  let mut guard = state.write().await;

  if guard.running {
    return Ok(SidecarStatus {
      running: true,
      port: guard.port,
      model_path: guard.model_path.clone(),
      secret: guard.secret.clone(),
      started_at_unix_ms: guard.started_at_unix_ms,
      last_error: guard.last_error.clone(),
    });
  }

  let port = args.port.unwrap_or(43211);
  let threads = args.threads.unwrap_or(6);
  let ctx_size = args.ctx_size.unwrap_or(2048);
  let n_gpu_layers = args.n_gpu_layers.unwrap_or(0);
  let secret = generate_secret();
  let bin_name = detect_binary_name();
  let resource_dir = app
    .path()
    .resource_dir()
    .map_err(|e| format!("resource dir error: {e}"))?;
  let bin_path = resource_dir.join("bin").join(bin_name);
  if is_placeholder_binary(&bin_path) {
    let msg = format!("Sidecar binary missing or placeholder: {}", bin_name);
    guard.last_error = Some(msg.clone());
    return Err(msg);
  }

  let mut cmd = Command::new(bin_path);
  cmd
    .arg("--model")
    .arg(&args.model_path)
    .arg("--host")
    .arg("127.0.0.1")
    .arg("--port")
    .arg(port.to_string())
    .arg("--ctx-size")
    .arg(ctx_size.to_string())
    .arg("--threads")
    .arg(threads.to_string())
    .arg("--n-gpu-layers")
    .arg(n_gpu_layers.to_string())
    .arg("--no-webui")
    .env("QPB_SIDECAR_SECRET", &secret)
    .kill_on_drop(true);

  let child = cmd.spawn().map_err(|e| format!("sidecar spawn failed: {e}"))?;
  guard.child = Some(child);

  if let Err(e) = wait_for_health(port, &secret, Duration::from_secs(20)).await {
    guard.last_error = Some(e.clone());
    if let Some(child) = guard.child.as_mut() {
      let _ = child.kill().await;
    }
    guard.child = None;
    guard.running = false;
    return Err(e);
  }

  guard.running = true;
  guard.port = Some(port);
  guard.model_path = Some(args.model_path);
  guard.secret = Some(secret);
  guard.started_at_unix_ms = Some(
    std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .map_err(|e| format!("clock error: {e}"))?
      .as_millis(),
  );
  guard.last_error = None;

  Ok(SidecarStatus {
    running: guard.running,
    port: guard.port,
    model_path: guard.model_path.clone(),
    secret: guard.secret.clone(),
    started_at_unix_ms: guard.started_at_unix_ms,
    last_error: guard.last_error.clone(),
  })
}

#[tauri::command]
pub async fn sidecar_stop(
  state: State<'_, Arc<RwLock<SidecarState>>>,
) -> Result<SidecarStatus, String> {
  let mut guard = state.write().await;
  if let Some(child) = guard.child.as_mut() {
    let _ = child.kill().await;
  }
  guard.child = None;
  guard.running = false;
  guard.port = None;
  guard.secret = None;
  guard.model_path = None;
  Ok(SidecarStatus {
    running: false,
    port: None,
    model_path: None,
    secret: None,
    started_at_unix_ms: None,
    last_error: guard.last_error.clone(),
  })
}

#[tauri::command]
pub async fn sidecar_status(
  state: State<'_, Arc<RwLock<SidecarState>>>,
) -> Result<SidecarStatus, String> {
  let guard = state.read().await;
  Ok(SidecarStatus {
    running: guard.running,
    port: guard.port,
    model_path: guard.model_path.clone(),
    secret: guard.secret.clone(),
    started_at_unix_ms: guard.started_at_unix_ms,
    last_error: guard.last_error.clone(),
  })
}

#[derive(Debug, Serialize)]
pub struct SidecarLogs {
  pub lines: Vec<String>,
}

#[tauri::command]
pub async fn sidecar_logs_tail() -> Result<SidecarLogs, String> {
  Ok(SidecarLogs {
    lines: vec![
      "log tail not yet wired to process stdout pipe".to_string(),
      "placeholder for production diagnostics export".to_string(),
    ],
  })
}
