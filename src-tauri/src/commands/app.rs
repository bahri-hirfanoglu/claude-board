//! App lifecycle commands.

use tauri::AppHandle;

/// Restarts the running app, which is what actually applies a downloaded update.
///
/// Uses `AppHandle::restart` rather than `tauri-plugin-process` so no extra
/// dependency or ACL permission is needed: app commands are not permission
/// gated, unlike the `plugin:process|restart` IPC call this replaces.
///
/// `restart` diverges — it runs the app's exit hooks and re-executes the binary,
/// so nothing after it is reachable.
#[tauri::command]
pub fn restart_app(app: AppHandle) {
    log::info!("Restart requested — re-executing to apply update");
    // Under `tauri dev` the restarted process comes back to a blank window: the
    // Tauri CLI owns the Vite dev server and tears it down when the original
    // process exits, so devUrl no longer resolves. A bundled build serves the
    // frontend from assets embedded in the binary, so it has nothing to lose.
    #[cfg(debug_assertions)]
    log::warn!("dev build: the restarted window will be blank because the dev server is gone");
    app.restart();
}
