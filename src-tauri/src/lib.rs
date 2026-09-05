// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::fs;
use std::net::{IpAddr, TcpStream, ToSocketAddrs};
use std::path::Path;
use std::time::{Duration, Instant};

use tauri::{Manager, Url};

/// 与 vite.config.ts 的 PREFERRED_PORT、tauri.conf.json 的 build.devUrl 保持一致
const DEV_URL_PORT: u16 = 1420;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 读取 Vite 写入的实际 dev 端口（src-tauri/.dev-port.json）；无文件/解析失败返回 None
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
            // dev 端口联动：Vite 首选 1420，被占用时自动换端口并写入 .dev-port.json。
            //
            // 时序说明（为什么必须轮询文件而不是读一次）：
            // Tauri CLI 会先探测 devUrl(1420) 可达才启动桌面壳；1420 被别的服务占用时
            // CLI 探测秒过即放行，而本项目 Vite 仍需 ~300ms 启动、且 listen 完成后才写
            // 端口文件——桌面壳可能早于文件出现。因此轮询等待文件（最多 10 秒），
            // 文件出现后再做端口就绪探测与窗口导航。
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
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
