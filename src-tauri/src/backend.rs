//! 本地 Spring Boot sidecar 生命周期管理。
//!
//! 桌面端不再要求用户预装 Java / 启动 IDE 后端：
//! - release：从 Tauri resource 目录取 `jre/bin/java` 与 `backend/ai-ssh-server-app.jar`，
//!   选一个空闲端口启动，健康检查通过后把 baseUrl 交给前端；
//! - debug：优先复用 8091 上已有的后端（IDE 调试），没有则尝试仓库 target 下的 jar；
//! - 退出时杀掉子进程，避免留下僵尸 Java。
//!
//! 数据目录通过 `AI_SSH_HOME` 传给 Spring Boot（本地 H2 库、agent.yml、日志都放这里）。

use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// 与 tauri.conf.json / vite.config.ts 的 dev 端口保持一致
const DEV_BACKEND_PORT: u16 = 8091;

/// 健康检查路径（SystemController；默认免鉴权，桌面端探针专用）
const HEALTH_PATH: &str = "/api/v1/system/health";

#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BackendInfo {
    /// starting | ready | error
    pub status: String,
    pub base_url: String,
    pub message: String,
    pub log_path: String,
    pub data_dir: String,
}

pub struct BackendManager {
    info: Mutex<BackendInfo>,
    child: Mutex<Option<Child>>,
    /// 启动线程占用标记：前端「重试」可能连续触发 backend_start，用 CAS 保证只拉起一个 Java
    starting: AtomicBool,
}

impl BackendManager {
    pub fn new(info: BackendInfo) -> Self {
        Self {
            info: Mutex::new(info),
            child: Mutex::new(None),
            starting: AtomicBool::new(false),
        }
    }
}

/// 启动线程退出时复位 `starting`（覆盖所有提前 return 分支）
struct StartingGuard {
    app: AppHandle,
}

impl Drop for StartingGuard {
    fn drop(&mut self) {
        if let Some(state) = self.app.try_state::<BackendManager>() {
            state.starting.store(false, Ordering::SeqCst);
        }
    }
}

fn set_info(app: &AppHandle, status: &str, base_url: &str, message: &str) {
    if let Some(state) = app.try_state::<BackendManager>() {
        if let Ok(mut info) = state.info.lock() {
            info.status = status.to_string();
            info.base_url = base_url.to_string();
            info.message = message.to_string();
        }
    }
}

/// 应用数据目录（Windows: %APPDATA%\jianingfei.site.aissh）
fn app_data_dir(app: &AppHandle) -> PathBuf {
    normalize_path(
        app.path()
            .app_data_dir()
            .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))),
    )
}

/// setup 阶段先给出一个 starting 快照，前端据此显示启动页
pub fn initial_info(app: &AppHandle) -> BackendInfo {
    let data_dir = app_data_dir(app);
    let log_path = data_dir.join("logs").join("backend.log");
    BackendInfo {
        status: "starting".to_string(),
        base_url: String::new(),
        message: "正在启动本地服务…".to_string(),
        log_path: log_path.to_string_lossy().to_string(),
        data_dir: data_dir.to_string_lossy().to_string(),
    }
}

/// Tauri 在 Windows 上返回的路径可能带 `\\?\` verbatim 前缀，而 JDK 的 `java -jar`
/// 打不开这种路径（表现是「尝试打开文件…时出现意外错误」），安装版因此起不来。
/// 这里统一还原成普通绝对路径：`\\?\C:\x` → `C:\x`，`\\?\UNC\srv\share` → `\\srv\share`。
fn normalize_path(path: PathBuf) -> PathBuf {
    let text = path.to_string_lossy().into_owned();
    if let Some(rest) = text.strip_prefix(r"\\?\") {
        if let Some(unc) = rest.strip_prefix(r"UNC\") {
            return PathBuf::from(format!(r"\\{unc}"));
        }
        return PathBuf::from(rest);
    }
    path
}

/// release 下从 resource 目录查找；debug 下从 src-tauri/resources 查找
fn find_resource(app: &AppHandle, relative: &str) -> Option<PathBuf> {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidate = normalize_path(resource_dir.join(relative));
        if candidate.exists() {
            return Some(candidate);
        }
    }
    if cfg!(debug_assertions) {
        let candidate = normalize_path(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("resources")
                .join(relative),
        );
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

fn resolve_java(app: &AppHandle) -> PathBuf {
    let bin = if cfg!(windows) { "bin/java.exe" } else { "bin/java" };
    if let Some(path) = find_resource(app, &format!("jre/{bin}")) {
        return path;
    }
    if cfg!(debug_assertions) {
        if let Ok(java_home) = std::env::var("JAVA_HOME") {
            let candidate = PathBuf::from(java_home).join(bin);
            if candidate.exists() {
                return candidate;
            }
        }
    }
    // 最后回退到 PATH；release 缺 JRE 时会在错误信息里体现
    PathBuf::from("java")
}

fn resolve_jar(app: &AppHandle) -> Option<PathBuf> {
    if let Some(path) = find_resource(app, "backend/ai-ssh-server-app.jar") {
        return Some(path);
    }
    if cfg!(debug_assertions) {
        // 仓库根：<repo>/ai-ssh-client/src-tauri -> ../..
        let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        if let Some(repo) = manifest.parent().and_then(|p| p.parent()) {
            let candidate = repo
                .join("ai-ssh-server")
                .join("ai-ssh-server-app")
                .join("target")
                .join("ai-ssh-server-app.jar");
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }
    None
}

fn port_open(port: u16) -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&addr, Duration::from_millis(250)).is_ok()
}

fn free_port() -> u16 {
    TcpListener::bind(("127.0.0.1", 0))
        .and_then(|listener| listener.local_addr())
        .map(|addr| addr.port())
        .unwrap_or(DEV_BACKEND_PORT)
}

/// 最小 HTTP 健康检查：不引入 HTTP 客户端依赖。
///
/// 只看 HTTP 200 不够：后端在数据库不可用时仍返回 200（body 里 code=0001 / status=DEGRADED），
/// 必须校验 body 的 `"status":"UP"`，否则会把「进程起来了但依赖不可用」误判为 ready。
fn http_ok(port: u16, path: &str) -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(300)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(800)));
    let request = format!(
        "GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n"
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    // 响应头 + 小 body：循环读到 EOF 或 4 KB 上限（健康检查 body 约 150 字节）
    let mut response = Vec::with_capacity(512);
    let mut chunk = [0u8; 512];
    loop {
        match stream.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => {
                response.extend_from_slice(&chunk[..n]);
                if response.len() >= 4096 {
                    break;
                }
            }
            Err(_) => break,
        }
    }
    let text = String::from_utf8_lossy(&response);
    text.starts_with("HTTP/1.1 200") && text.contains("\"status\":\"UP\"")
}

fn log_tail(path: &Path) -> String {
    let Ok(file) = File::open(path) else {
        return String::new();
    };
    let mut file = file;
    let len = file.metadata().map(|m| m.len()).unwrap_or(0);
    let start = len.saturating_sub(8 * 1024);
    if file.seek(SeekFrom::Start(start)).is_err() {
        return String::new();
    }
    let mut text = String::new();
    let _ = file.read_to_string(&mut text);
    text
}

/// 后台线程入口：启动、等待健康检查、更新状态
pub fn start(app: AppHandle) {
    let state = app.state::<BackendManager>();
    // 并发保护：前端「重试」可能连续触发 backend_start，用 CAS 保证只拉起一个 Java 进程
    if state.starting.swap(true, Ordering::SeqCst) {
        return;
    }
    let _starting_guard = StartingGuard { app: app.clone() };
    {
        if let Ok(info) = state.info.lock() {
            if info.status == "ready" {
                return;
            }
        }
        if state
            .child
            .lock()
            .map(|child| child.is_some())
            .unwrap_or(false)
        {
            return;
        }
    }

    let data_dir = app_data_dir(&app);
    let logs_dir = data_dir.join("logs");
    let data_sub = data_dir.join("data");
    if let Err(e) = fs::create_dir_all(&logs_dir).and_then(|_| fs::create_dir_all(&data_sub)) {
        set_info(&app, "error", "", &format!("创建数据目录失败: {e}"));
        return;
    }
    let log_path = logs_dir.join("backend.log");

    set_info(&app, "starting", "", "正在启动本地服务…");

    // debug 下若 IDE 已经起了 8091 后端，直接复用，避免端口冲突；
    // 设置 AI_SSH_DEV_LOCAL=1 可强制拉起打包的本地后端（用随机端口，验证 sidecar 用）。
    let force_local = std::env::var("AI_SSH_DEV_LOCAL")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    // 8091 上「确实是本项目且状态健康」才复用：仅探测端口会把任意占用者误当成后端
    let dev_port_healthy = cfg!(debug_assertions)
        && !force_local
        && port_open(DEV_BACKEND_PORT)
        && http_ok(DEV_BACKEND_PORT, HEALTH_PATH);
    if dev_port_healthy {
        set_info(
            &app,
            "ready",
            &format!("http://127.0.0.1:{DEV_BACKEND_PORT}"),
            "已连接本机 8091 后端",
        );
        return;
    }

    let Some(jar) = resolve_jar(&app) else {
        set_info(
            &app,
            "error",
            "",
            "未找到后端 jar：请先运行 npm run backend:bundle（或启动 IDE 后端占用 8091）",
        );
        return;
    };
    if !jar.exists() {
        set_info(&app, "error", "", &format!("后端 jar 不存在: {}", jar.display()));
        return;
    }

    // 8091 空闲才用固定端口；已被别的进程占用（或后端不健康）时换随机空闲端口，避免绑定失败
    let port = if cfg!(debug_assertions) && !force_local && !port_open(DEV_BACKEND_PORT) {
        DEV_BACKEND_PORT
    } else {
        free_port()
    };
    let java = resolve_java(&app);

    let log_out = match OpenOptions::new().create(true).append(true).open(&log_path) {
        Ok(file) => file,
        Err(e) => {
            set_info(&app, "error", "", &format!("无法打开后端日志: {e}"));
            return;
        }
    };
    let log_err = match log_out.try_clone() {
        Ok(file) => file,
        Err(e) => {
            set_info(&app, "error", "", &format!("无法复制日志句柄: {e}"));
            return;
        }
    };

    let mut command = Command::new(&java);
    command
        .arg("-Dfile.encoding=UTF-8")
        .arg("-jar")
        .arg(&jar)
        .arg("--spring.profiles.active=local")
        .arg(format!("--server.port={port}"))
        .arg("--server.address=127.0.0.1")
        .current_dir(&data_dir)
        .env("AI_SSH_HOME", &data_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::from(log_out))
        .stderr(Stdio::from(log_err));
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    let child = match command.spawn() {
        Ok(child) => child,
        Err(e) => {
            set_info(
                &app,
                "error",
                "",
                &format!(
                    "启动 Java 失败（{}）: {e}；请确认已运行 npm run backend:bundle",
                    java.display()
                ),
            );
            return;
        }
    };

    {
        let state = app.state::<BackendManager>();
        let mut slot = match state.child.lock() {
            Ok(slot) => slot,
            Err(_) => return,
        };
        *slot = Some(child);
    }

    let deadline = Instant::now() + Duration::from_secs(90);
    let mut last_error = String::new();
    loop {
        if http_ok(port, HEALTH_PATH) {
            set_info(
                &app,
                "ready",
                &format!("http://127.0.0.1:{port}"),
                "本地服务已就绪",
            );
            return;
        }

        // 子进程提前退出：把日志尾部带给前端，避免只有转圈
        {
            let state = app.state::<BackendManager>();
            let mut exit_status = None;
            if let Ok(mut slot) = state.child.lock() {
                if let Some(child) = slot.as_mut() {
                    if let Ok(Some(status)) = child.try_wait() {
                        exit_status = Some(status);
                    }
                }
                if exit_status.is_some() {
                    *slot = None;
                }
            }
            if let Some(status) = exit_status {
                last_error = format!("本地服务进程已退出（{status}）");
            }
        }
        if !last_error.is_empty() {
            let tail = log_tail(&log_path);
            let message = if tail.is_empty() {
                last_error
            } else {
                format!("{}\n\n{}", last_error, tail)
            };
            set_info(&app, "error", "", &message);
            return;
        }

        if Instant::now() >= deadline {
            let tail = log_tail(&log_path);
            let message = if tail.is_empty() {
                "本地服务启动超时（90 秒）".to_string()
            } else {
                format!("本地服务启动超时（90 秒）\n\n{tail}")
            };
            set_info(&app, "error", "", &message);
            return;
        }
        std::thread::sleep(Duration::from_millis(300));
    }
}

pub fn shutdown(app: &AppHandle) {
    let Some(state) = app.try_state::<BackendManager>() else {
        return;
    };
    // 先把 child move 出来并显式结束 guard，避免 MutexGuard 临时值拖住 state 的生命周期
    let child = {
        let mut slot = match state.child.lock() {
            Ok(slot) => slot,
            Err(_) => return,
        };
        slot.take()
    };
    if let Some(mut child) = child {
        #[cfg(windows)]
        {
            let _ = Command::new("taskkill")
                .args(["/PID", &child.id().to_string(), "/T", "/F"])
                .creation_flags(CREATE_NO_WINDOW)
                .status();
        }
        let _ = child.kill();
        let _ = child.wait();
    }
}

#[tauri::command]
pub fn backend_info(state: State<'_, BackendManager>) -> BackendInfo {
    state
        .info
        .lock()
        .map(|info| info.clone())
        .unwrap_or_default()
}

#[tauri::command]
pub fn backend_start(app: AppHandle) {
    std::thread::spawn(move || start(app));
}
