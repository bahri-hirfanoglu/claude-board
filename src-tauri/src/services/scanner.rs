use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

// ─── constants ───

const MAX_DEPTH: usize = 15;
const MAX_FILE_SIZE: u64 = 1_048_576; // 1 MB
const MAX_TREE_ENTRIES: usize = 200;

/// Directories always excluded regardless of .gitignore
const ALWAYS_EXCLUDE_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "target",
    "__pycache__",
    ".venv",
    "vendor",
    ".cache",
];

/// File names always excluded
const ALWAYS_EXCLUDE_FILES: &[&str] = &["package-lock.json"];

/// Extensions always excluded (lock files except Cargo.lock)
const ALWAYS_EXCLUDE_LOCK: &[&str] = &[
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lockb",
    "Gemfile.lock",
    "poetry.lock",
    "composer.lock",
    "flake.lock",
];

/// Binary file extensions to skip
const BINARY_EXTENSIONS: &[&str] = &[
    // Images
    "png", "jpg", "jpeg", "gif", "bmp", "ico", "svg", "webp", "tiff", "tif", "avif",
    // Videos
    "mp4", "avi", "mov", "mkv", "webm", "flv", "wmv",
    // Audio
    "mp3", "wav", "ogg", "flac", "aac", "wma",
    // Fonts
    "ttf", "otf", "woff", "woff2", "eot",
    // Compiled / object
    "exe", "dll", "so", "dylib", "o", "obj", "class", "pyc", "pyo", "wasm",
    // Archives
    "zip", "tar", "gz", "bz2", "xz", "7z", "rar", "jar", "war",
    // Other binary
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "sqlite", "db",
];

// ─── public types ───

#[derive(Serialize, Clone, Debug)]
pub struct ScanStats {
    pub total_files: usize,
    pub total_lines: usize,
    pub total_size_bytes: u64,
    pub languages: HashMap<String, LanguageStats>,
    pub project_types: Vec<String>,
    pub largest_files: Vec<(String, u64)>,
}

#[derive(Serialize, Clone, Debug)]
pub struct LanguageStats {
    pub files: usize,
    pub lines: usize,
    pub percentage: f64,
}

// ─── gitignore parsing ───

struct GitignoreRules {
    patterns: Vec<GitignorePattern>,
}

struct GitignorePattern {
    pattern: String,
    is_negation: bool,
    is_dir_only: bool,
}

impl GitignoreRules {
    fn load(working_dir: &Path) -> Self {
        let gitignore_path = working_dir.join(".gitignore");
        let mut patterns = Vec::new();

        if let Ok(content) = fs::read_to_string(&gitignore_path) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() || trimmed.starts_with('#') {
                    continue;
                }

                let is_negation = trimmed.starts_with('!');
                let raw = if is_negation { &trimmed[1..] } else { trimmed };
                let is_dir_only = raw.ends_with('/');
                let clean = raw.trim_end_matches('/').to_string();

                if !clean.is_empty() {
                    patterns.push(GitignorePattern {
                        pattern: clean,
                        is_negation,
                        is_dir_only,
                    });
                }
            }
        }

        Self { patterns }
    }

    fn is_ignored(&self, rel_path: &str, is_dir: bool) -> bool {
        let mut ignored = false;
        for pat in &self.patterns {
            if pat.is_dir_only && !is_dir {
                continue;
            }
            if glob_match(&pat.pattern, rel_path) {
                ignored = !pat.is_negation;
            }
        }
        ignored
    }
}

/// Simple glob matching supporting `*`, `**`, and `?`.
fn glob_match(pattern: &str, path: &str) -> bool {
    // If pattern has no slash, match against the file/dir name only
    if !pattern.contains('/') {
        let name = path.rsplit('/').next().unwrap_or(path);
        return simple_glob(pattern, name);
    }

    // Pattern with slash: match against full relative path
    let pattern = pattern.trim_start_matches('/');
    simple_glob(pattern, path)
}

fn simple_glob(pattern: &str, text: &str) -> bool {
    // Handle ** (matches everything including path separators)
    if pattern.contains("**") {
        let parts: Vec<&str> = pattern.split("**").collect();
        if parts.len() == 2 {
            let prefix = parts[0].trim_end_matches('/');
            let suffix = parts[1].trim_start_matches('/');
            if prefix.is_empty() && suffix.is_empty() {
                return true;
            }
            if prefix.is_empty() {
                // **/suffix — match suffix anywhere
                return text.ends_with(suffix)
                    || text.contains(&format!("/{}", suffix))
                    || simple_glob(suffix, text);
            }
            if suffix.is_empty() {
                // prefix/** — match anything starting with prefix
                return text.starts_with(prefix)
                    || text.starts_with(&format!("{}/", prefix));
            }
            // prefix/**/suffix
            if let Some(pos) = text.find(prefix) {
                let rest = &text[pos + prefix.len()..];
                let rest = rest.trim_start_matches('/');
                return simple_glob(suffix, rest)
                    || rest.contains('/') && {
                        // try matching suffix against each sub-path
                        rest.split('/')
                            .enumerate()
                            .any(|(i, _)| {
                                let sub: String = rest.split('/').skip(i).collect::<Vec<_>>().join("/");
                                simple_glob(suffix, &sub)
                            })
                    };
            }
            return false;
        }
    }

    // Simple wildcard matching with * and ?
    wildcard_match(pattern, text)
}

fn wildcard_match(pattern: &str, text: &str) -> bool {
    let p: Vec<char> = pattern.chars().collect();
    let t: Vec<char> = text.chars().collect();
    let (plen, tlen) = (p.len(), t.len());
    let mut dp = vec![vec![false; tlen + 1]; plen + 1];
    dp[0][0] = true;

    for i in 1..=plen {
        if p[i - 1] == '*' {
            dp[i][0] = dp[i - 1][0];
        }
    }

    for i in 1..=plen {
        for j in 1..=tlen {
            if p[i - 1] == '*' {
                dp[i][j] = dp[i - 1][j] || dp[i][j - 1];
            } else if p[i - 1] == '?' || p[i - 1] == t[j - 1] {
                dp[i][j] = dp[i - 1][j - 1];
            }
        }
    }

    dp[plen][tlen]
}

// ─── file walking ───

struct WalkContext {
    root: PathBuf,
    gitignore: GitignoreRules,
    entries: Vec<WalkEntry>,
}

struct WalkEntry {
    path: PathBuf,
    rel_path: String,
    size: u64,
}

impl WalkContext {
    fn walk(&mut self) {
        self.walk_dir(&self.root.clone(), 0);
    }

    fn walk_dir(&mut self, dir: &Path, depth: usize) {
        if depth > MAX_DEPTH {
            return;
        }

        let read_dir = match fs::read_dir(dir) {
            Ok(rd) => rd,
            Err(_) => return,
        };

        let mut entries: Vec<fs::DirEntry> = read_dir.filter_map(|e| e.ok()).collect();
        entries.sort_by_key(|e| e.file_name());

        for entry in entries {
            let path = entry.path();
            let file_name = entry.file_name();
            let name = file_name.to_string_lossy();

            let rel = path
                .strip_prefix(&self.root)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");

            let is_dir = path.is_dir();

            // Always-exclude checks
            if is_dir && ALWAYS_EXCLUDE_DIRS.contains(&name.as_ref()) {
                continue;
            }
            if !is_dir && ALWAYS_EXCLUDE_FILES.contains(&name.as_ref()) {
                continue;
            }
            if !is_dir && ALWAYS_EXCLUDE_LOCK.contains(&name.as_ref()) {
                continue;
            }

            // Gitignore check
            if self.gitignore.is_ignored(&rel, is_dir) {
                continue;
            }

            if is_dir {
                self.walk_dir(&path, depth + 1);
                continue;
            }

            // Skip binary extensions
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                let ext_lower = ext.to_lowercase();
                if BINARY_EXTENSIONS.contains(&ext_lower.as_str()) {
                    continue;
                }
                // Skip generic .lock files (but not Cargo.lock)
                if ext_lower == "lock" && name != "Cargo.lock" {
                    continue;
                }
            }

            // Skip files larger than 1MB
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            if size > MAX_FILE_SIZE {
                continue;
            }

            self.entries.push(WalkEntry {
                path,
                rel_path: rel,
                size,
            });
        }
    }
}

// ─── extension to language mapping ───

fn ext_to_language(ext: &str) -> Option<&'static str> {
    match ext.to_lowercase().as_str() {
        "rs" => Some("Rust"),
        "js" | "mjs" | "cjs" => Some("JavaScript"),
        "jsx" => Some("JavaScript"),
        "ts" | "mts" | "cts" => Some("TypeScript"),
        "tsx" => Some("TypeScript"),
        "py" | "pyw" => Some("Python"),
        "go" => Some("Go"),
        "java" => Some("Java"),
        "rb" => Some("Ruby"),
        "php" => Some("PHP"),
        "swift" => Some("Swift"),
        "kt" | "kts" => Some("Kotlin"),
        "c" | "h" => Some("C"),
        "cpp" | "cxx" | "cc" | "hpp" | "hxx" => Some("C++"),
        "cs" => Some("C#"),
        "html" | "htm" => Some("HTML"),
        "css" => Some("CSS"),
        "scss" | "sass" => Some("SCSS"),
        "less" => Some("Less"),
        "json" | "jsonc" => Some("JSON"),
        "md" | "mdx" => Some("Markdown"),
        "sql" => Some("SQL"),
        "yml" | "yaml" => Some("YAML"),
        "toml" => Some("TOML"),
        "xml" | "xsl" | "xslt" => Some("XML"),
        "sh" | "bash" | "zsh" => Some("Shell"),
        "ps1" | "psm1" => Some("PowerShell"),
        "bat" | "cmd" => Some("Batch"),
        "lua" => Some("Lua"),
        "r" => Some("R"),
        "dart" => Some("Dart"),
        "vue" => Some("Vue"),
        "svelte" => Some("Svelte"),
        "astro" => Some("Astro"),
        "graphql" | "gql" => Some("GraphQL"),
        "proto" => Some("Protobuf"),
        "dockerfile" => Some("Dockerfile"),
        "tf" | "hcl" => Some("Terraform"),
        "zig" => Some("Zig"),
        "ex" | "exs" => Some("Elixir"),
        "erl" | "hrl" => Some("Erlang"),
        "hs" => Some("Haskell"),
        "ml" | "mli" => Some("OCaml"),
        "clj" | "cljs" => Some("Clojure"),
        "scala" | "sc" => Some("Scala"),
        "pl" | "pm" => Some("Perl"),
        _ => None,
    }
}

fn count_lines(path: &Path) -> usize {
    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return 0,
    };
    let reader = BufReader::new(file);
    reader.lines().count()
}

// ─── public API ───

/// Detect project types based on marker files in the working directory.
pub fn detect_project_type(working_dir: &str) -> Vec<String> {
    let root = Path::new(working_dir);
    let mut types = Vec::new();

    let has_file = |name: &str| root.join(name).exists();

    let has_package_json = has_file("package.json");

    // Check for React (jsx/tsx files)
    let has_react_files = has_package_json && has_extension_in_dir(root, &["jsx", "tsx"], 3);

    if has_file("tauri.conf.json") || root.join("src-tauri").join("tauri.conf.json").exists() {
        types.push("Tauri".to_string());
    }
    if has_react_files {
        types.push("React".to_string());
    }
    if has_file("tsconfig.json") {
        types.push("TypeScript".to_string());
    }
    if has_package_json && !has_react_files {
        types.push("Node.js".to_string());
    } else if has_package_json && has_react_files {
        // React already covers Node.js context, but we still note it
        types.push("Node.js".to_string());
    }
    if has_file("Cargo.toml") {
        types.push("Rust".to_string());
    }
    if has_file("go.mod") {
        types.push("Go".to_string());
    }
    if has_file("requirements.txt") || has_file("pyproject.toml") {
        types.push("Python".to_string());
    }
    if has_file("pom.xml") || has_file("build.gradle") || has_file("build.gradle.kts") {
        types.push("Java".to_string());
    }
    if has_file("Gemfile") {
        types.push("Ruby".to_string());
    }
    if has_file("composer.json") {
        types.push("PHP".to_string());
    }
    if has_file("Package.swift") || has_extension_in_dir(root, &["swift"], 2) {
        types.push("Swift".to_string());
    }

    types
}

/// Recursively check if a directory contains files with given extensions (limited depth).
fn has_extension_in_dir(dir: &Path, extensions: &[&str], max_depth: usize) -> bool {
    if max_depth == 0 {
        return false;
    }
    let read_dir = match fs::read_dir(dir) {
        Ok(rd) => rd,
        Err(_) => return false,
    };
    for entry in read_dir.filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = entry.file_name();
        let name_str = name.to_string_lossy();

        if path.is_dir() {
            if ALWAYS_EXCLUDE_DIRS.contains(&name_str.as_ref()) {
                continue;
            }
            if has_extension_in_dir(&path, extensions, max_depth - 1) {
                return true;
            }
        } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            if extensions.contains(&ext) {
                return true;
            }
        }
    }
    false
}

/// Collect statistics about a project directory.
pub fn collect_stats(working_dir: &str) -> ScanStats {
    let root = PathBuf::from(working_dir);
    let gitignore = GitignoreRules::load(&root);

    let mut ctx = WalkContext {
        root,
        gitignore,
        entries: Vec::new(),
    };
    ctx.walk();

    let project_types = detect_project_type(working_dir);

    let mut total_lines: usize = 0;
    let mut total_size: u64 = 0;
    let mut lang_files: HashMap<String, (usize, usize)> = HashMap::new(); // (files, lines)
    let mut file_sizes: Vec<(String, u64)> = Vec::new();

    for entry in &ctx.entries {
        let lines = count_lines(&entry.path);
        total_lines += lines;
        total_size += entry.size;

        file_sizes.push((entry.rel_path.clone(), entry.size));

        if let Some(ext) = entry.path.extension().and_then(|e| e.to_str()) {
            if let Some(lang) = ext_to_language(ext) {
                let stat = lang_files.entry(lang.to_string()).or_insert((0, 0));
                stat.0 += 1;
                stat.1 += lines;
            }
        }
    }

    // Top 5 largest files
    file_sizes.sort_by(|a, b| b.1.cmp(&a.1));
    file_sizes.truncate(5);

    // Build language stats with percentages
    let total_files = ctx.entries.len();
    let languages: HashMap<String, LanguageStats> = lang_files
        .into_iter()
        .map(|(lang, (files, lines))| {
            let percentage = if total_files > 0 {
                (files as f64 / total_files as f64) * 100.0
            } else {
                0.0
            };
            (
                lang,
                LanguageStats {
                    files,
                    lines,
                    percentage,
                },
            )
        })
        .collect();

    ScanStats {
        total_files,
        total_lines,
        total_size_bytes: total_size,
        languages,
        project_types,
        largest_files: file_sizes,
    }
}

/// Generate a textual file tree representation of a project directory.
pub fn generate_file_tree(working_dir: &str, max_depth: usize) -> String {
    let root = PathBuf::from(working_dir);
    let gitignore = GitignoreRules::load(&root);
    let effective_depth = max_depth.min(MAX_DEPTH);

    let mut output = String::new();
    let root_name = root
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| working_dir.to_string());
    output.push_str(&root_name);
    output.push('\n');

    let mut count: usize = 0;
    build_tree(&root, &root, &gitignore, "", effective_depth, 0, &mut output, &mut count);

    if count >= MAX_TREE_ENTRIES {
        output.push_str(&format!("\n... ({} entries shown, more files exist)\n", MAX_TREE_ENTRIES));
    }

    output
}

#[allow(clippy::too_many_arguments)]
fn build_tree(
    dir: &Path,
    root: &Path,
    gitignore: &GitignoreRules,
    prefix: &str,
    max_depth: usize,
    depth: usize,
    output: &mut String,
    count: &mut usize,
) {
    if depth >= max_depth || *count >= MAX_TREE_ENTRIES {
        return;
    }

    let read_dir = match fs::read_dir(dir) {
        Ok(rd) => rd,
        Err(_) => return,
    };

    let mut entries: Vec<fs::DirEntry> = read_dir.filter_map(|e| e.ok()).collect();
    entries.sort_by(|a, b| {
        let a_dir = a.path().is_dir();
        let b_dir = b.path().is_dir();
        // Directories first, then alphabetical
        b_dir.cmp(&a_dir).then_with(|| a.file_name().cmp(&b.file_name()))
    });

    // Filter out excluded entries
    let entries: Vec<&fs::DirEntry> = entries
        .iter()
        .filter(|entry| {
            let path = entry.path();
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            let is_dir = path.is_dir();

            if is_dir && ALWAYS_EXCLUDE_DIRS.contains(&name_str.as_ref()) {
                return false;
            }
            if !is_dir && ALWAYS_EXCLUDE_FILES.contains(&name_str.as_ref()) {
                return false;
            }
            if !is_dir && ALWAYS_EXCLUDE_LOCK.contains(&name_str.as_ref()) {
                return false;
            }
            if !is_dir {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    let ext_lower = ext.to_lowercase();
                    if BINARY_EXTENSIONS.contains(&ext_lower.as_str()) {
                        return false;
                    }
                    if ext_lower == "lock" && name_str != "Cargo.lock" {
                        return false;
                    }
                }
            }

            let rel = path
                .strip_prefix(root)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");
            !gitignore.is_ignored(&rel, is_dir)
        })
        .collect();

    let total = entries.len();
    for (i, entry) in entries.iter().enumerate() {
        if *count >= MAX_TREE_ENTRIES {
            return;
        }

        let is_last = i == total - 1;
        let connector = if is_last { "\u{2514}\u{2500}\u{2500} " } else { "\u{251c}\u{2500}\u{2500} " };
        let child_prefix = if is_last { "    " } else { "\u{2502}   " };

        let name = entry.file_name();
        let path = entry.path();

        output.push_str(prefix);
        output.push_str(connector);
        output.push_str(&name.to_string_lossy());
        if path.is_dir() {
            output.push('/');
        }
        output.push('\n');
        *count += 1;

        if path.is_dir() {
            let new_prefix = format!("{}{}", prefix, child_prefix);
            build_tree(&path, root, gitignore, &new_prefix, max_depth, depth + 1, output, count);
        }
    }
}
