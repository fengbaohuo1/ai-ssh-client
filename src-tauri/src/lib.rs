// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::fs;
use std::net::TcpStream;
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

/// 轮询等待端口可连接（Vite 可能仍在启动中；最多等 5 秒）
fn wait_until_listening(port: u16) -> bool {
    let deadline = Instant::now() + Duration::from_secs(5);
    let addr = format!("127.0.0.1:{port}");
    while Instant::now() < deadline {
        if TcpStream::connect_timeout(&addr.parse().unwrap(), Duration::from_millis(300)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
            // dev 端口联动：Vite 首选 1420，被占用时自动换端口并写入 .dev-port.json；
            // 实际端口与 devUrl(1420) 不一致时，把主窗口导航到真实地址，避免白屏
            if let Some(port) = actual_dev_port() {
                if port != DEV_URL_PORT {
                    println!("[dev-port] dev server 实际端口 {port}，等待就绪后导航窗口…");
                    if wait_until_listening(port) {
                        let url = Url::parse(&format!("http://localhost:{port}")).expect("dev url 解析失败");
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.navigate(url);
                            println!("[dev-port] 已导航到 http://localhost:{port}");
                        }
                    }
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
