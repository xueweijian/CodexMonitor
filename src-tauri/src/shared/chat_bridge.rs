use crate::types::{ThirdPartyProvider, WireApiMode};
use std::sync::Arc;

pub mod translate;

pub fn start_chat_bridge(provider: ThirdPartyProvider) -> Result<u16, String> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    
    let server = tiny_http::Server::from_listener(listener, None).map_err(|e| e.to_string())?;
    let handle = tokio::runtime::Handle::current();
    let provider = Arc::new(provider);

    std::thread::spawn(move || {
        let client = reqwest::Client::new();
        for mut request in server.incoming_requests() {
            let provider = provider.clone();
            let client = client.clone();
            let handle = handle.clone();
            
            std::thread::spawn(move || {
                let url = request.url().to_string();
                if url.starts_with("/v1/models") {
                    let target = format!("{}/models", provider.base_url);
                    let mut req = client.get(&target);
                    if let Some(ref k) = provider.api_key {
                        if !k.is_empty() {
                            req = req.header("Authorization", format!("Bearer {}", k));
                        }
                    }
                    if let Ok(res) = handle.block_on(async { req.send().await }) {
                        let status = res.status();
                        let body = handle.block_on(async { res.bytes().await }).unwrap_or_default();
                        let response = tiny_http::Response::from_data(body.to_vec()).with_status_code(status.as_u16());
                        let _ = request.respond(response);
                    } else {
                        let _ = request.respond(tiny_http::Response::from_string("Error").with_status_code(500));
                    }
                    return;
                }
                
                // Very basic fallback
                let _ = request.respond(tiny_http::Response::from_string("OK").with_status_code(200));
            });
        }
    });

    Ok(port)
}
