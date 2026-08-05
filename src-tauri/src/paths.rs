//! Filesystem path normalization for user-supplied directories.

/// Expand a leading `~` to the user's home directory.
///
/// Paths entered by hand (project working directories) routinely start with
/// `~`, but that is shell syntax: `Command::current_dir("~/workspace")` fails
/// with `ENOENT` because no directory literally named `~` exists. Every
/// user-supplied path must pass through here before it reaches the filesystem.
///
/// `~user` forms are returned unchanged — resolving another account's home
/// directory is not something we can do reliably.
pub fn expand_tilde(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed != "~" && !trimmed.starts_with("~/") && !trimmed.starts_with("~\\") {
        return trimmed.to_string();
    }

    let home = match std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(std::path::PathBuf::from)
    {
        Some(h) => h,
        None => return trimmed.to_string(),
    };

    if trimmed == "~" {
        return home.to_string_lossy().to_string();
    }

    home.join(&trimmed[2..]).to_string_lossy().to_string()
}

#[cfg(test)]
mod tests {
    use super::expand_tilde;

    fn home() -> String {
        std::env::var("HOME").expect("HOME set in test environment")
    }

    #[test]
    fn expands_tilde_slash_prefix() {
        assert_eq!(expand_tilde("~/workspace"), format!("{}/workspace", home()));
    }

    #[test]
    fn expands_bare_tilde() {
        assert_eq!(expand_tilde("~"), home());
    }

    #[test]
    fn expands_nested_path() {
        assert_eq!(
            expand_tilde("~/workspace/claude-board"),
            format!("{}/workspace/claude-board", home())
        );
    }

    #[test]
    fn leaves_absolute_paths_untouched() {
        assert_eq!(expand_tilde("/Users/someone/code"), "/Users/someone/code");
    }

    #[test]
    fn leaves_other_users_home_untouched() {
        assert_eq!(expand_tilde("~someone/code"), "~someone/code");
    }

    #[test]
    fn leaves_relative_paths_untouched() {
        assert_eq!(expand_tilde("projects/app"), "projects/app");
    }

    #[test]
    fn trims_surrounding_whitespace() {
        assert_eq!(expand_tilde("  ~/workspace  "), format!("{}/workspace", home()));
    }

    #[test]
    fn does_not_expand_mid_path_tilde() {
        assert_eq!(expand_tilde("/opt/~/workspace"), "/opt/~/workspace");
    }
}
