use std::env::consts::{ARCH, OS};
use std::path::PathBuf;
use tokio::process::Command;
use tauri::{Emitter, Manager};
use futures_util::StreamExt;

/// Check if npm is available on the system
pub async fn check_npm_available() -> bool {
    let program = if cfg!(target_os = "windows") { "npm.cmd" } else { "npm" };
    Command::new(program)
        .arg("--version")
        .output()
        .await
        .is_ok()
}

/// Helper to get a rough locale
fn is_zh_locale() -> bool {
    if let Ok(lang) = std::env::var("LANG") {
        if lang.to_lowercase().starts_with("zh") {
            return true;
        }
    }
    if let Ok(lang) = std::env::var("LANGUAGE") {
        if lang.to_lowercase().starts_with("zh") {
            return true;
        }
    }
    false
}

/// Execute npm install to install codex
pub async fn install_codex_via_npm(package_name: &str) -> Result<(), String> {
    let program = if cfg!(target_os = "windows") { "npm.cmd" } else { "npm" };
    let mut cmd = Command::new(program);
    
    cmd.arg("install").arg("-g").arg(package_name);

    if is_zh_locale() {
        cmd.arg("--registry=https://registry.npmmirror.com");
    }

    let output = cmd.output().await.map_err(|e| format!("Failed to run npm: {}", e))?;
    
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Direct HTTP download of standalone binary (fallback)
pub async fn download_standalone_binary(
    app_handle: &tauri::AppHandle,
) -> Result<PathBuf, String> {
    let target_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("codex-bin");
        
    tokio::fs::create_dir_all(&target_dir)
        .await
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    let filename = if cfg!(target_os = "windows") {
        format!("codex-{}-{}.exe", ARCH, OS)
    } else {
        format!("codex-{}-{}", ARCH, OS)
    };

    let mut url = format!(
        "https://github.com/your-org/codex/releases/latest/download/{}",
        filename
    );

    if is_zh_locale() {
        url = format!("https://mirror.ghproxy.com/{}", url);
    }

    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to download: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);
    
    let mut stream = response.bytes_stream();
    let target_file = target_dir.join(&filename);
    let mut file = tokio::fs::File::create(&target_file)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;
        
    let mut downloaded: u64 = 0;
    
    #[derive(serde::Serialize, Clone)]
    struct ProgressPayload {
        downloaded: u64,
        total: u64,
    }

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Error reading chunk: {}", e))?;
        tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
            .await
            .map_err(|e| format!("Error writing chunk: {}", e))?;
            
        downloaded += chunk.len() as u64;
        
        let _ = app_handle.emit("download_progress", ProgressPayload {
            downloaded,
            total: total_size,
        });
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = tokio::fs::metadata(&target_file)
            .await
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        tokio::fs::set_permissions(&target_file, perms)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(target_file)
}

#[tauri::command]
pub async fn download_codex_cli(app_handle: tauri::AppHandle) -> Result<(), String> {
    if check_npm_available().await {
        if let Err(e) = install_codex_via_npm("@openai/codex").await {
            eprintln!("npm install failed: {}, falling back to direct download", e);
            let bin_path = download_standalone_binary(&app_handle).await?;
            // save it to settings
            let state = app_handle.state::<crate::state::AppState>();
            let mut settings = state.app_settings.lock().await;
            settings.codex_bin = Some(bin_path.to_string_lossy().to_string());
            let path = crate::paths::app_settings_file(&app_handle).map_err(|e| e.to_string())?;
            crate::storage::write_settings(&path, &settings).map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    let bin_path = download_standalone_binary(&app_handle).await?;
    let state = app_handle.state::<crate::state::AppState>();
    let mut settings = state.app_settings.lock().await;
    settings.codex_bin = Some(bin_path.to_string_lossy().to_string());
    let path = crate::paths::app_settings_file(&app_handle).map_err(|e| e.to_string())?;
    crate::storage::write_settings(&path, &settings).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn save_codex_path(path: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let state = app_handle.state::<crate::state::AppState>();
    let mut settings = state.app_settings.lock().await;
    settings.codex_bin = Some(path);
    let settings_path = crate::paths::app_settings_file(&app_handle).map_err(|e| e.to_string())?;
    crate::storage::write_settings(&settings_path, &settings).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_check_npm_available() {
        // Just verify it doesn't panic
        let _ = check_npm_available().await;
    }
}
