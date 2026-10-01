use std::process::Command;

fn git(args: &[&str]) -> String {
    Command::new("git")
        .args(args)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "unknown".to_string())
}

fn main() {
    // Build identity shown in Settings -> About. Scripts may override with FLOWSTATE_BUILD / FLOWSTATE_HASH.
    let build =
        std::env::var("FLOWSTATE_BUILD").unwrap_or_else(|_| git(&["rev-list", "--count", "HEAD"]));
    let hash =
        std::env::var("FLOWSTATE_HASH").unwrap_or_else(|_| git(&["rev-parse", "--short", "HEAD"]));
    println!("cargo:rustc-env=FLOWSTATE_BUILD={build}");
    println!("cargo:rustc-env=FLOWSTATE_HASH={hash}");
    // Re-run when HEAD moves (commit, checkout) so About shows the current build. `--git-path`
    // resolves the right files in worktrees, where .git is a file.
    for rel in ["HEAD", "logs/HEAD"] {
        let path = git(&["rev-parse", "--git-path", rel]);
        if path != "unknown" {
            println!("cargo:rerun-if-changed={path}");
        }
    }
    println!("cargo:rerun-if-env-changed=FLOWSTATE_BUILD");
    println!("cargo:rerun-if-env-changed=FLOWSTATE_HASH");
    tauri_build::build()
}
