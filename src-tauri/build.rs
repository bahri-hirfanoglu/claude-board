fn main() {
    #[cfg(target_os = "windows")]
    {
        let mut windows = tauri_build::WindowsAttributes::new();
        if std::env::var("PROFILE").unwrap_or_default() == "release" {
            windows = windows.app_manifest(include_str!("app.manifest"));
        }
        let attrs = tauri_build::Attributes::new().windows_attributes(windows);
        tauri_build::try_build(attrs).expect("failed to run build script");
    }

    #[cfg(not(target_os = "windows"))]
    {
        tauri_build::build();
    }
}
