mod models;
mod sidecar;

use std::sync::Arc;

use models::{
  models_delete,
  models_download_cancel,
  models_download_start,
  models_list_available,
  models_list_installed,
  models_set_default,
  models_verify,
  ModelManagerState,
};
use sidecar::{sidecar_logs_tail, sidecar_start, sidecar_status, sidecar_stop, SidecarState};
use tauri::Manager;
use tokio::sync::RwLock;

pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .setup(|app| {
      app.manage(Arc::new(RwLock::new(SidecarState::default())));
      app.manage(Arc::new(RwLock::new(ModelManagerState::default())));
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      sidecar_start,
      sidecar_stop,
      sidecar_status,
      sidecar_logs_tail,
      models_list_available,
      models_list_installed,
      models_download_start,
      models_download_cancel,
      models_verify,
      models_delete,
      models_set_default
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
