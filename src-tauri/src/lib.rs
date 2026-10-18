// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod backend;

#[cfg(debug_assertions)]
use std::fs;
#[cfg(debug_assertions)]
use std::net::{IpAddr, TcpStream, ToSocketAddrs};
#[cfg(debug_assertions)]
use std::path::Path;
#[cfg(debug_assertions)]
use std::time::{Duration, Instant};

use tauri::Manager;
#[cfg(debug_assertions)]
use tauri::Url;

/// 与 vite.config.ts 的 PREFERRED_PORT、tauri.conf.json 的 build.devUrl 保持一致（仅 dev 使用）
#[cfg(debug_assertions)]
const DEV_URL_PORT: u16 = 1420;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 读取 Vite 写入的实际 dev 端口（src-tauri/.dev-port.json）；无文件/解析失败返回 None
#[cfg(debug_assertions)]
fn actual_dev_port() -> Option<u16> {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join(".dev-port.json");
    let text = fs::read_to_string(path).ok()?;
    let value: serde_json::Value = serde_json::from_str(&text).ok()?;
    value.get("port")?.as_u64().map(|p| p as u16)
}

/// 轮询等待端口可连接，返回实际连通的那个 IP。
///
/// 必须双栈探测：Vite 对 localhost 的解析在 IPv4/IPv6 间不稳定（node 的行为），
/// 若它实际监听在 ::1 而只探测 127.0.0.1 会永远超时。
#[cfg(debug_assertions)]
fn wait_until_listening(port: u16) -> Option<IpAddr> {
    let deadline = Instant::now() + Duration::from_secs(5);
    // 解析 localhost 的全部地址（IPv4 + IPv6），逐个尝试
    let mut addrs: Vec<std::net::SocketAddr> = match format!("localhost:{port}").to_socket_addrs() {
        Ok(resolved) => resolved.collect(),
        Err(_) => vec![],
    };
    if addrs.is_empty() {
        addrs.push(format!("127.0.0.1:{port}").parse().expect("静态地址解析不应失败"));
    }
    while Instant::now() < deadline {
        for addr in &addrs {
            if TcpStream::connect_timeout(addr, Duration::from_millis(250)).is_ok() {
                return Some(addr.ip());
            }
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    None
}

/// dev 端口联动：Vite 首选 1420，被占用时自动换端口并写入 .dev-port.json。
///
/// 时序说明（为什么必须轮询文件而不是读一次）：
/// Tauri CLI 会先探测 devUrl(1420) 可达才启动桌面壳；1420 被别的服务占用时
/// CLI 探测秒过即放行，而本项目 Vite 仍需 ~300ms 启动、且 listen 完成后才写
/// 端口文件——桌面壳可能早于文件出现。因此轮询等待文件（最多 10 秒），
/// 文件出现后再做端口就绪探测与窗口导航。
#[cfg(debug_assertions)]
fn wire_dev_port(app: &tauri::App) {
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        if let Some(port) = actual_dev_port() {
            if port == DEV_URL_PORT {
                // 首选端口可用：devUrl 即正确地址，无需导航
                break;
            }
            println!("[dev-port] 检测到 dev server 实际端口 {port}，探测就绪地址…");
            match wait_until_listening(port) {
                Some(ip) => {
                    // 导航到实际连通的地址（IPv6 需加方括号），不依赖 WebView 的 localhost 解析
                    let host = if ip.is_ipv6() { format!("[{ip}]") } else { ip.to_string() };
                    let url = Url::parse(&format!("http://{host}:{port}")).expect("dev url 解析失败");
                    if let Some(window) = app.get_webview_window("main") {
                        match window.navigate(url) {
                            Ok(_) => println!("[dev-port] 已导航到 http://{host}:{port}"),
                            Err(e) => eprintln!("[dev-port] 导航失败: {e}"),
                        }
                    } else {
                        eprintln!("[dev-port] 找不到主窗口（label=main）");
                    }
                }
                None => eprintln!("[dev-port] 端口 {port} 就绪探测超时（5 秒），保持 devUrl 行为"),
            }
            break;
        }
        if Instant::now() >= deadline {
            // 超时仍未出现文件（例如 Vite 启动失败），保持 devUrl 原行为
            eprintln!("[dev-port] 10 秒内未等到端口文件（Vite 是否启动失败？）");
            break;
        }
        std::thread::sleep(Duration::from_millis(200));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // 桌面端单实例：避免两个窗口同时启动 sidecar / 抢同一个 H2 文件锁
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            backend::backend_info,
            backend::backend_start
        ])
        .setup(|app| {
            // 先启动本地 Spring Boot sidecar（异步，不阻塞窗口）
            let backend_handle = app.handle().clone();
            let info = backend::initial_info(&backend_handle);
            app.manage(backend::BackendManager::new(info));
            std::thread::spawn(move || backend::start(backend_handle));

            // dev 端口联动：Vite 换端口时把窗口导航到实际地址。
            // release 下不参与（CARGO_MANIFEST_DIR 是构建机路径，且用户机上不存在该文件，
            // 若不加编译期门禁会让每次启动都空转 10 秒）。
            #[cfg(debug_assertions)]
            wire_dev_port(app);

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if matches!(
            event,
            tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. }
        ) {
            backend::shutdown(app_handle);
        }
    });
}
