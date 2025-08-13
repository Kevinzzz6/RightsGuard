// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{MenuBuilder, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder},
    Manager
};

// 引入模块
mod database;
mod automation;
mod models;
mod commands;

use commands::*;

fn main() {
    // 初始化日志
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    tauri::Builder::default()
        .setup(|app| {
            // 初始化数据库
            let _app_handle = app.handle();
            tauri::async_runtime::block_on(async {
                if let Err(e) = database::init_database().await {
                    eprintln!("Failed to initialize database: {}", e);
                }
            });

            // 设置系统托盘
            let show_item = MenuItem::with_id(app, "show", "显示", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "隐藏", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            
            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .item(&hide_item)
                .separator()
                .item(&quit_item)
                .build()?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .menu(&menu)
                .tooltip("RightsGuard - 版权申诉工具")
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                window.show().unwrap();
                                window.set_focus().unwrap();
                            }
                        }
                        "hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                window.hide().unwrap();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            window.show().unwrap();
                            window.set_focus().unwrap();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 个人档案相关命令
            get_profile,
            save_profile,
            
            // IP资产相关命令
            get_ip_assets,
            get_ip_asset,
            save_ip_asset,
            delete_ip_asset,
            
            // 案件相关命令
            get_cases,
            save_case,
            delete_case,
            
            // 自动化相关命令
            start_automation,
            stop_automation,
            get_automation_status,
            
            // 文件相关命令
            select_file,
            select_files,
            
            // 系统相关命令
            open_url,
            show_message
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}