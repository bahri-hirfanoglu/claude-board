//! Environment for spawned child processes.
//!
//! A GUI app launched from Finder or the Dock inherits launchd's `PATH`, which is
//! `/usr/bin:/bin:/usr/sbin:/sbin` unless the user has run `launchctl setenv`.
//! Tools installed under `~/.local/bin` — where the official Claude Code
//! installer puts `claude` — or under Homebrew are therefore invisible, and
//! spawning `claude` fails with "No such file or directory (os error 2)".
//!
//! Running under `tauri dev` hides this entirely, because that process is started
//! from a terminal and inherits the shell's `PATH`. The bug only appears in an
//! installed build, with identical configuration.
//!
//! So rather than trusting the inherited `PATH`, child processes get one extended
//! with the usual install locations, and `claude` is resolved to an absolute path
//! whenever it can be found.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

fn home() -> Option<PathBuf> {
    std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .ok()
        .map(PathBuf::from)
}

/// Directories tools are commonly installed into, beyond the launchd default.
/// Ordered by how likely they are to hold the binary the user actually runs.
fn extra_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(home) = home() {
        dirs.push(home.join(".local").join("bin")); // official Claude Code installer
        dirs.push(home.join(".bun").join("bin"));
        dirs.push(home.join(".volta").join("bin"));
        dirs.push(home.join(".npm-global").join("bin"));
        dirs.push(home.join(".yarn").join("bin"));
        dirs.push(home.join("bin"));
    }
    dirs.push(PathBuf::from("/opt/homebrew/bin")); // Apple silicon Homebrew
    dirs.push(PathBuf::from("/usr/local/bin")); // Intel Homebrew, manual installs
    dirs
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

    let mut dirs: Vec<PathBuf> = Vec::with_capacity(inherited.len());
    for dir in inherited.into_iter().chain(extra_dirs()) {
        if !dirs.contains(&dir) {
            dirs.push(dir);
        }
    }
    dirs
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

/// First `dirs` entry containing an executable named `program`, honouring the
/// platform's executable suffix.
fn find_program(program: &str, dirs: &[PathBuf]) -> Option<PathBuf> {
    let filename = format!("{}{}", program, std::env::consts::EXE_SUFFIX);
    dirs.iter()
        .map(|dir| dir.join(&filename))
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
