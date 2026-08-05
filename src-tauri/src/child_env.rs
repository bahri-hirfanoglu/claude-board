//! Environment for spawned child processes.
//!
//! On macOS a GUI app launched from Finder or the Dock inherits launchd's `PATH`,
//! which is `/usr/bin:/bin:/usr/sbin:/sbin` unless the user has run
//! `launchctl setenv`. Tools under `~/.local/bin` — where the official Claude Code
//! installer puts `claude` — or under Homebrew are therefore invisible, and
//! spawning them fails with "No such file or directory (os error 2)". Running
//! under `tauri dev` hides this entirely, because that process starts from a
//! terminal and inherits the shell's `PATH`, so the bug appears only in an
//! installed build with identical configuration.
//!
//! Rather than trusting the inherited `PATH`, child processes get one extended
//! with the login shell's `PATH` and the usual install locations, and programs are
//! resolved to an absolute path whenever one can be found.
//!
//! Platform differences this handles:
//!
//! - **Windows** inherits the user and system `PATH` from the registry, so the
//!   shell probe is skipped. Executable extensions come from `PATHEXT`, which
//!   matters because npm ships `npx.cmd` rather than `npx.exe`.
//! - **Unix** carries an executable bit, so a readable-but-not-executable file is
//!   not a match.
//! - **Node version managers** put only the active version's directory on `PATH`,
//!   from a shell function, so that directory cannot be named ahead of time. The
//!   shell probe covers it; enumerating nvm, fnm and asdf layouts is the fallback.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

fn home() -> Option<PathBuf> {
    std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .ok()
        .map(PathBuf::from)
}

/// Immediate subdirectories of `parent`, newest name last so callers can reverse
/// for a highest-version-first ordering. Empty when `parent` does not exist.
fn subdirs(parent: &Path) -> Vec<PathBuf> {
    let mut out: Vec<PathBuf> = match std::fs::read_dir(parent) {
        Ok(entries) => entries
            .flatten()
            .map(|e| e.path())
            .filter(|p| p.is_dir())
            .collect(),
        Err(_) => return Vec::new(),
    };
    out.sort();
    out
}

/// Node version managers install each version under its own directory and put the
/// active one on `PATH` from a shell function, so the directory is only reachable
/// after the shell's rc files run. These are the layouts to fall back on when the
/// login shell cannot be consulted, newest version first.
fn node_manager_dirs(home: &Path) -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    for version in subdirs(&home.join(".nvm").join("versions").join("node"))
        .into_iter()
        .rev()
    {
        dirs.push(version.join("bin"));
    }

    for base in [
        home.join(".fnm").join("node-versions"),
        home.join("Library")
            .join("Application Support")
            .join("fnm")
            .join("node-versions"),
    ] {
        for version in subdirs(&base).into_iter().rev() {
            dirs.push(version.join("installation").join("bin"));
        }
    }

    dirs.push(home.join(".asdf").join("shims"));
    for version in subdirs(&home.join(".asdf").join("installs").join("nodejs"))
        .into_iter()
        .rev()
    {
        dirs.push(version.join("bin"));
    }

    dirs
}

/// Directories tools are commonly installed into, beyond the launchd default.
/// Ordered by how likely they are to hold the binary the user actually runs.
fn extra_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(home) = home() {
        dirs.push(home.join(".local").join("bin")); // official Claude Code installer
        dirs.push(home.join(".bun").join("bin"));
        dirs.push(home.join(".volta").join("bin")); // volta shims
        dirs.push(home.join(".npm-global").join("bin"));
        dirs.push(home.join(".yarn").join("bin"));
        dirs.push(home.join("bin"));
        dirs.extend(node_manager_dirs(&home));
    }
    dirs.push(PathBuf::from("/opt/homebrew/bin")); // Apple silicon Homebrew
    dirs.push(PathBuf::from("/usr/local/bin")); // Intel Homebrew, manual installs
    dirs
}

/// Markers that isolate the value from anything an interactive rc file prints.
const PATH_OPEN: &str = "<<<CB_PATH:";
const PATH_CLOSE: &str = ":CB_PATH>>>";

/// `PATH` as the user's login shell reports it.
///
/// Version managers such as nvm are shell functions, so the directory holding the
/// active Node lives on `PATH` only after the rc files run — asking the shell is
/// the only way to learn which version is active. Runs interactively (`-i`)
/// because zsh users typically initialise those managers in `.zshrc`.
///
/// Returns `None` rather than hanging: stdin is closed so an rc file cannot block
/// on input, and the child is killed if it outlives the deadline.
///
/// Windows is skipped. A GUI process there inherits the user and system `PATH`
/// from the registry, so nothing is missing from the inherited value, and `-ilc`
/// is POSIX shell syntax — a `SHELL` pointing at Git Bash would report MSYS paths
/// like `/c/Users/...` that `Command` cannot use.
fn login_shell_path() -> Option<String> {
    if cfg!(windows) {
        return None;
    }

    let shell = std::env::var("SHELL").ok()?;
    if shell.is_empty() {
        return None;
    }

    let script = format!("printf '{}%s{}' \"$PATH\"", PATH_OPEN, PATH_CLOSE);
    let mut child = std::process::Command::new(&shell)
        .args(["-ilc", &script])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .ok()?;

    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if std::time::Instant::now() < deadline => {
                std::thread::sleep(std::time::Duration::from_millis(25));
            }
            Ok(None) => {
                log::warn!("login shell did not report PATH within 5s; killing it");
                child.kill().ok();
                child.wait().ok();
                return None;
            }
            Err(_) => return None,
        }
    }

    let out = child.wait_with_output().ok()?;
    let stdout = String::from_utf8_lossy(&out.stdout);
    extract_marked_path(&stdout).map(str::to_string)
}

/// The `PATH` between the markers, or `None` when the shell printed neither.
fn extract_marked_path(output: &str) -> Option<&str> {
    let start = output.find(PATH_OPEN)? + PATH_OPEN.len();
    let rest = &output[start..];
    let end = rest.find(PATH_CLOSE)?;
    let value = &rest[..end];
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

/// The inherited `PATH` followed by any [`extra_dirs`] not already on it.
///
/// Inherited entries keep priority, so a user who has deliberately put a
/// particular `claude` earlier on their `PATH` still gets that one.
///
/// Repeated entries are dropped, keeping the first occurrence. Shells routinely
/// accumulate duplicates from re-sourced profiles, and since lookup takes the
/// first match, removing the later copies cannot change which binary is found.
fn build_search_dirs() -> Vec<PathBuf> {
    let inherited = std::env::var_os("PATH")
        .map(|p| std::env::split_paths(&p).collect::<Vec<_>>())
        .unwrap_or_default();

    let from_shell: Vec<PathBuf> = shell_path()
        .map(|p| std::env::split_paths(p).collect())
        .unwrap_or_default();

    let mut dirs: Vec<PathBuf> = Vec::with_capacity(inherited.len() + from_shell.len());
    for dir in inherited
        .into_iter()
        .chain(from_shell)
        .chain(extra_dirs())
    {
        if !dirs.contains(&dir) {
            dirs.push(dir);
        }
    }
    dirs
}

/// The login shell's `PATH`, probed once. `None` when the shell cannot be asked.
fn shell_path() -> Option<&'static String> {
    static SHELL_PATH: OnceLock<Option<String>> = OnceLock::new();
    SHELL_PATH.get_or_init(login_shell_path).as_ref()
}

/// `PATH` to hand to child processes.
///
/// Also matters for the child's own subprocesses: `claude` shells out to `git`,
/// which a Homebrew-only install would otherwise fail to find.
pub fn search_path() -> &'static str {
    static PATH: OnceLock<String> = OnceLock::new();
    PATH.get_or_init(|| {
        std::env::join_paths(build_search_dirs())
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|_| std::env::var("PATH").unwrap_or_default())
    })
}

/// Filenames to try for `program`, in order.
///
/// A name that already carries an extension is used as-is, so `npx.cmd` is not
/// looked up as `npx.cmd.exe`. Otherwise Windows tries each `PATHEXT` entry,
/// because an executable's extension there is a matter of configuration and npm
/// ships `npx.cmd` rather than `npx.exe`. Elsewhere the bare name is the name.
fn candidate_filenames(program: &str) -> Vec<String> {
    if Path::new(program).extension().is_some() {
        return vec![program.to_string()];
    }

    if !cfg!(windows) {
        return vec![program.to_string()];
    }

    let pathext =
        std::env::var("PATHEXT").unwrap_or_else(|_| ".COM;.EXE;.BAT;.CMD".to_string());
    let mut names: Vec<String> = pathext
        .split(';')
        .map(str::trim)
        .filter(|ext| !ext.is_empty())
        .map(|ext| format!("{}{}", program, ext.to_ascii_lowercase()))
        .collect();
    names.push(program.to_string());
    names
}

/// First executable named `program` found by scanning `dirs` in order, trying each
/// candidate filename within a directory before moving to the next — the same
/// precedence a shell applies.
fn find_program(program: &str, dirs: &[PathBuf]) -> Option<PathBuf> {
    let names = candidate_filenames(program);
    dirs.iter()
        .flat_map(|dir| names.iter().map(move |name| dir.join(name)))
        .find(|candidate| is_executable_file(candidate))
}

fn is_executable_file(path: &Path) -> bool {
    match std::fs::metadata(path) {
        Ok(meta) => {
            if !meta.is_file() {
                return false;
            }
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                meta.permissions().mode() & 0o111 != 0
            }
            #[cfg(not(unix))]
            {
                true
            }
        }
        Err(_) => false,
    }
}

/// An absolute path to `name` when one can be found, and otherwise `name` itself
/// so `PATH` lookup still applies — leaving any failure to surface at the call
/// site as it always has, rather than as a startup error.
pub fn program(name: &str) -> String {
    match find_program(name, &build_search_dirs()) {
        Some(path) => path.to_string_lossy().into_owned(),
        None => name.to_string(),
    }
}

/// The `claude` program to spawn. Resolved once, since it is on the path of every
/// task launch.
pub fn claude_program() -> &'static str {
    static PROGRAM: OnceLock<String> = OnceLock::new();
    PROGRAM.get_or_init(|| {
        let resolved = program("claude");
        if resolved == "claude" {
            log::warn!(
                "no claude executable found on PATH or in the usual install locations; \
                 spawning by bare name"
            );
        } else {
            log::info!("resolved claude to {}", resolved);
        }
        resolved
    })
}

/// A [`std::process::Command`] for `name` with the program resolved and a usable
/// `PATH`. Callers add their own arguments, stdio and environment.
pub fn command(name: &str) -> std::process::Command {
    let mut cmd = std::process::Command::new(program(name));
    cmd.env("PATH", search_path());
    cmd
}

/// [`command`] for `claude`, using the cached resolution.
pub fn claude_command() -> std::process::Command {
    let mut cmd = std::process::Command::new(claude_program());
    cmd.env("PATH", search_path());
    cmd
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_dirs_keep_inherited_entries_first() {
        let dirs = build_search_dirs();

        // The inherited entries, deduplicated the same way, must lead the list in
        // their original order — the extras only ever get appended.
        let mut expected: Vec<PathBuf> = Vec::new();
        let inherited = std::env::var_os("PATH")
            .map(|p| std::env::split_paths(&p).collect::<Vec<_>>())
            .unwrap_or_default();
        for dir in inherited {
            if !expected.contains(&dir) {
                expected.push(dir);
            }
        }

        assert_eq!(
            dirs[..expected.len()],
            expected[..],
            "inherited PATH must keep priority and order"
        );
    }

    #[test]
    fn search_dirs_add_the_installer_location() {
        let dirs = build_search_dirs();
        if let Some(home) = home() {
            let local_bin = home.join(".local").join("bin");
            assert!(
                dirs.contains(&local_bin),
                "~/.local/bin missing — that is where the Claude Code installer puts the binary"
            );
        }
    }

    #[test]
    fn search_dirs_contain_no_duplicates() {
        let dirs = build_search_dirs();
        let mut seen = dirs.clone();
        seen.sort();
        seen.dedup();
        assert_eq!(seen.len(), dirs.len(), "duplicate entry in the search path");
    }

    #[test]
    fn find_program_locates_an_executable_and_skips_the_rest() {
        let tmp = std::env::temp_dir().join(format!("cb-child-env-{}", std::process::id()));
        let empty = tmp.join("empty");
        let with_bin = tmp.join("bin");
        std::fs::create_dir_all(&empty).unwrap();
        std::fs::create_dir_all(&with_bin).unwrap();

        let name = format!("faux-claude{}", std::env::consts::EXE_SUFFIX);
        let exe = with_bin.join(&name);
        std::fs::write(&exe, b"#!/bin/sh\n").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&exe, std::fs::Permissions::from_mode(0o755)).unwrap();
        }

        // Found by scanning past a directory that does not hold it.
        let dirs = vec![empty.clone(), with_bin.clone()];
        assert_eq!(find_program("faux-claude", &dirs), Some(exe.clone()));

        // A name that is not there resolves to nothing rather than a bogus path.
        assert_eq!(find_program("definitely-not-here", &dirs), None);

        // A directory is not an executable.
        assert_eq!(find_program("bin", std::slice::from_ref(&tmp)), None);

        std::fs::remove_dir_all(&tmp).ok();
    }

    #[cfg(unix)]
    #[test]
    fn find_program_ignores_a_non_executable_file() {
        let tmp = std::env::temp_dir().join(format!("cb-child-env-perm-{}", std::process::id()));
        std::fs::create_dir_all(&tmp).unwrap();
        let path = tmp.join("claude");
        std::fs::write(&path, b"not executable").unwrap();
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).unwrap();

        assert_eq!(find_program("claude", std::slice::from_ref(&tmp)), None);

        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn marked_path_is_extracted_from_noisy_shell_output() {
        let noisy = format!(
            "\u{1b}[1msome prompt\u{1b}[0m\nwarning: rc file chatter\n{}/usr/bin:/bin{}",
            PATH_OPEN, PATH_CLOSE
        );
        assert_eq!(extract_marked_path(&noisy), Some("/usr/bin:/bin"));
    }

    #[test]
    fn marked_path_is_none_when_absent_or_empty() {
        assert_eq!(extract_marked_path("no markers here"), None);
        assert_eq!(extract_marked_path(&format!("{}{}", PATH_OPEN, PATH_CLOSE)), None);
        // An opening marker with no close is not a value.
        assert_eq!(extract_marked_path(&format!("{}/usr/bin", PATH_OPEN)), None);
    }

    #[test]
    fn find_program_does_not_append_a_suffix_to_a_name_that_has_one() {
        let tmp = std::env::temp_dir().join(format!("cb-child-env-ext-{}", std::process::id()));
        std::fs::create_dir_all(&tmp).unwrap();
        let exe = tmp.join("npx.cmd");
        std::fs::write(&exe, b"@echo off").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&exe, std::fs::Permissions::from_mode(0o755)).unwrap();
        }

        // Would look for npx.cmd.exe on Windows if the suffix were applied blindly.
        assert_eq!(
            find_program("npx.cmd", std::slice::from_ref(&tmp)),
            Some(exe.clone())
        );

        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn candidate_filenames_respect_an_existing_extension() {
        // Must not become npx.cmd.exe on Windows.
        assert_eq!(candidate_filenames("npx.cmd"), vec!["npx.cmd".to_string()]);
    }

    #[cfg(not(windows))]
    #[test]
    fn candidate_filenames_are_just_the_name_off_windows() {
        assert_eq!(candidate_filenames("npx"), vec!["npx".to_string()]);
    }

    #[cfg(windows)]
    #[test]
    fn candidate_filenames_cover_pathext_on_windows() {
        let names = candidate_filenames("npx");
        assert!(names.contains(&"npx.cmd".to_string()), "npm ships npx.cmd, not npx.exe");
        assert!(names.contains(&"npx.exe".to_string()));
        assert!(names.contains(&"npx".to_string()), "extensionless name is the last resort");
    }

    #[test]
    fn node_manager_dirs_offer_nvm_versions_newest_first() {
        let tmp = std::env::temp_dir().join(format!("cb-child-env-nvm-{}", std::process::id()));
        let versions = tmp.join(".nvm").join("versions").join("node");
        for v in ["v18.1.0", "v20.20.2"] {
            std::fs::create_dir_all(versions.join(v).join("bin")).unwrap();
        }

        let dirs = node_manager_dirs(&tmp);
        let nvm: Vec<&PathBuf> = dirs.iter().filter(|d| d.starts_with(&versions)).collect();
        assert_eq!(nvm.len(), 2);
        assert_eq!(nvm[0], &versions.join("v20.20.2").join("bin"), "newest first");

        // asdf shims are offered even when no nodejs install directory exists.
        assert!(dirs.contains(&tmp.join(".asdf").join("shims")));

        std::fs::remove_dir_all(&tmp).ok();
    }

    /// Regression test for an installed build failing with "No such file or
    /// directory": under launchd's PATH neither claude nor npx is reachable by
    /// bare name. Run under a minimal environment to reproduce that case:
    ///   env -i HOME=$HOME SHELL=$SHELL PATH=/usr/bin:/bin:/usr/sbin:/sbin <test-bin> --ignored
    #[test]
    #[ignore = "environment-dependent; run manually, including under a minimal PATH"]
    fn tools_resolve_to_absolute_paths() {
        for name in ["claude", "npx", "git"] {
            let resolved = program(name);
            assert_ne!(resolved, name, "{name} did not resolve to a path");
            assert!(
                Path::new(&resolved).is_absolute(),
                "{name} resolved to {resolved}, which is not absolute"
            );
            eprintln!("{name} -> {resolved}");
        }
    }

    #[test]
    #[ignore = "spawns the user's login shell; run manually with --ignored"]
    fn login_shell_reports_a_usable_path() {
        let path = login_shell_path().expect("login shell reported no PATH");
        assert!(path.contains(std::path::MAIN_SEPARATOR), "not a path list: {path}");
        eprintln!("login shell PATH entries: {}", path.split(':').count());
    }

    #[test]
    fn claude_program_is_absolute_when_the_binary_exists() {
        // Only assert the shape: on a machine without claude installed the
        // fallback is the bare name, which is still correct behaviour.
        let program = claude_program();
        if program != "claude" {
            assert!(
                Path::new(program).is_absolute(),
                "expected an absolute path, got {program}"
            );
            assert!(is_executable_file(Path::new(program)));
        }
    }
}
