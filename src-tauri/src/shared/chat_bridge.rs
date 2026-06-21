use crate::types::ThirdPartyProvider;
use serde_json::{json, Value};
use std::sync::Arc;
use std::io::Read;

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
                
                if url.contains("responses") {
                    let mut content = String::new();
                    let _ = request.as_reader().read_to_string(&mut content);
                    
                    let parsed: Value = serde_json::from_str(&content).unwrap_or_else(|_| json!({}));
                    let instructions = parsed.get("instructions").and_then(|i| i.as_str());
                    let empty_arr = json!([]);
                    let input = parsed.get("input").unwrap_or(&empty_arr);
                    
                    let messages = translate::responses_input_to_chat_messages(input, instructions);
                    
                    let mut payload = serde_json::Map::new();
                    payload.insert("model".to_string(), json!(provider.model));
                    payload.insert("messages".to_string(), messages);
                    payload.insert("stream".to_string(), json!(true));
                    
                    if let Some(t) = parsed.get("temperature") {
                        payload.insert("temperature".to_string(), t.clone());
                    }
                    if let Some(tp) = parsed.get("top_p") {
                        payload.insert("top_p".to_string(), tp.clone());
                    }
                    if let Some(mt) = parsed.get("max_output_tokens").or_else(|| parsed.get("max_tokens")) {
                        payload.insert("max_tokens".to_string(), mt.clone());
                    }
                    
                    if let Some(chat_tools) = translate::responses_tools_to_chat_tools(parsed.get("tools")) {
                        payload.insert("tools".to_string(), chat_tools);
                        if let Some(tc) = parsed.get("tool_choice") {
                            payload.insert("tool_choice".to_string(), tc.clone());
                        }
                    }
                    
                    let payload_value = Value::Object(payload);
                    let target = format!("{}/chat/completions", provider.base_url);
                    let body_str = serde_json::to_string(&payload_value).unwrap_or_default();
                    let mut req = client.post(&target)
                        .header("Content-Type", "application/json")
                        .body(body_str);
                    if let Some(ref k) = provider.api_key {
                        if !k.is_empty() {
                            req = req.header("Authorization", format!("Bearer {}", k));
                        }
                    }
                    
                    let (tx, rx) = std::sync::mpsc::sync_channel::<Vec<u8>>(32);
                    
                    let provider_model = provider.model.clone();
                    handle.spawn(async move {
                        if let Ok(mut res) = req.send().await {
                            if !res.status().is_success() {
                                let status = res.status();
                                let mut error_body = String::new();
                                while let Ok(Some(chunk)) = res.chunk().await {
                                    error_body.push_str(&String::from_utf8_lossy(&chunk));
                                }
                                let error_msg = format!("upstream returned HTTP {}: {}", status, error_body);
                                let end_events = translate::build_responses_failed_event(&error_msg, &provider_model);
                                let _ = tx.send(end_events.into_bytes());
                                return;
                            }
                            let mut is_first = true;
                            let mut buffer = String::new();
                            let mut completed_sent = false;
                            let mut text_acc = String::new();
                            let mut tool_calls = std::collections::HashMap::new();
                            let mut next_output_index = 1;
                            
                            println!("[chat_bridge] Upstream connection established. Streaming response...");
                            
                            while let Ok(chunk_opt) = res.chunk().await {
                                if let Some(chunk_res) = chunk_opt {
                                    let s = String::from_utf8_lossy(&chunk_res);
                                    buffer.push_str(&s);
                                    
                                    while let Some(pos) = buffer.find('\n') {
                                        let line = buffer[..pos].to_string();
                                        buffer = buffer[pos + 1..].to_string();
                                        
                                        let line = line.trim();
                                        if line.starts_with("data: ") {
                                            let data_str = &line[6..];
                                            if data_str == "[DONE]" {
                                                if !completed_sent {
                                                    completed_sent = true;
                                                    let end_events = translate::build_responses_completed_events(&text_acc, &provider_model, &mut tool_calls);
                                                    let _ = tx.send(end_events.into_bytes());
                                                    println!("[chat_bridge] Streaming completed normally. [DONE]");
                                                }
                                                break;
                                            } else if let Ok(parsed_delta) = serde_json::from_str::<Value>(data_str) {
                                                let mapped = translate::chat_delta_to_responses_sse(&parsed_delta, &mut is_first, &mut text_acc, &provider_model, &mut tool_calls, &mut next_output_index);
                                                if !mapped.is_empty() {
                                                    if tx.send(mapped.into_bytes()).is_err() {
                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    break;
                                }
                            }
                            
                            if !completed_sent {
                                let end_events = translate::build_responses_completed_events(&text_acc, &provider_model, &mut tool_calls);
                                let _ = tx.send(end_events.into_bytes());
                                println!("[chat_bridge] Streaming finished abruptly without [DONE] tag.");
                            }
                        } else {
                            println!("[chat_bridge] Upstream connection failed!");
                            let end_events = translate::build_responses_failed_event("upstream connection failed", &provider_model);
                            let _ = tx.send(end_events.into_bytes());
                        }
                    });
                    
                    struct ChannelReader {
                        rx: std::sync::mpsc::Receiver<Vec<u8>>,
                        buffer: std::io::Cursor<Vec<u8>>,
                    }
                    impl std::io::Read for ChannelReader {
                        fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
                            if self.buffer.position() < self.buffer.get_ref().len() as u64 {
                                return self.buffer.read(buf);
                            }
                            match self.rx.recv() {
                                Ok(data) => {
                                    self.buffer = std::io::Cursor::new(data);
                                    self.buffer.read(buf)
                                }
                                Err(_) => Ok(0), // EOF
                            }
                        }
                    }
                    
                    let reader = ChannelReader {
                        rx,
                        buffer: std::io::Cursor::new(Vec::new()),
                    };
                    
                    // We need headers to specify event stream
                    let headers = vec![
                        tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/event-stream"[..]).unwrap(),
                        tiny_http::Header::from_bytes(&b"Cache-Control"[..], &b"no-cache"[..]).unwrap(),
                    ];
                    
                    let response = tiny_http::Response::empty(200)
                        .with_chunked_threshold(0)
                        .with_data(reader, None);
                        
                    let response = headers.into_iter().fold(response, |r, h| r.with_header(h));
                        
                    let _ = request.respond(response);
                    return;
                }
                
                // Very basic fallback
                let _ = request.respond(tiny_http::Response::from_string("OK").with_status_code(200));
            });
        }
    });

    Ok(port)
}
