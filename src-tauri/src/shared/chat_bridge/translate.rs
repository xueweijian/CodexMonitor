use serde_json::{json, Value};

pub fn responses_input_to_chat_messages(input: &Value, instructions: Option<&str>) -> Value {
    let mut messages = Vec::new();

    if let Some(inst) = instructions {
        if !inst.is_empty() {
            messages.push(json!({
                "role": "system",
                "content": inst
            }));
        }
    }

    if let Some(arr) = input.as_array() {
        for item in arr {
            let item_type = item.get("type").and_then(|t| t.as_str()).unwrap_or("");
            if item_type == "message" || item.get("role").is_some() {
                let raw_role = item.get("role").and_then(|r| r.as_str()).unwrap_or("user");
                let role = if raw_role == "developer" { "system" } else { raw_role };
                
                let mut content_str = String::new();
                if let Some(content_arr) = item.get("content").and_then(|c| c.as_array()) {
                    for part in content_arr {
                        if let Some(text) = part.get("text").and_then(|t| t.as_str()) {
                            content_str.push_str(text);
                        } else if let Some(content) = part.get("content").and_then(|t| t.as_str()) {
                            content_str.push_str(content);
                        }
                    }
                } else if let Some(content_str_direct) = item.get("content").and_then(|c| c.as_str()) {
                    content_str.push_str(content_str_direct);
                }

                messages.push(json!({
                    "role": role,
                    "content": content_str
                }));
            } else if item_type == "function_call" {
                let call_id = item.get("call_id").or_else(|| item.get("id")).and_then(|v| v.as_str()).unwrap_or("");
                let name = item.get("name").and_then(|v| v.as_str()).unwrap_or("");
                let arguments = item.get("arguments").and_then(|v| v.as_str()).unwrap_or("");
                
                messages.push(json!({
                    "role": "assistant",
                    "content": null,
                    "tool_calls": [{
                        "id": call_id,
                        "type": "function",
                        "function": {
                            "name": name,
                            "arguments": arguments
                        }
                    }]
                }));
            } else if item_type == "function_call_output" || item_type == "custom_tool_call_output" {
                let call_id = item.get("call_id").and_then(|v| v.as_str()).unwrap_or("");
                
                let mut output_str = String::new();
                if let Some(output) = item.get("output") {
                    if let Some(s) = output.as_str() {
                        output_str.push_str(s);
                    } else if let Some(arr) = output.as_array() {
                        for part in arr {
                            if let Some(text) = part.get("text").and_then(|t| t.as_str()) {
                                output_str.push_str(text);
                                output_str.push('\n');
                            } else if let Some(content) = part.get("content").and_then(|t| t.as_str()) {
                                output_str.push_str(content);
                                output_str.push('\n');
                            }
                        }
                    } else {
                        output_str = output.to_string();
                    }
                }
                
                messages.push(json!({
                    "role": "tool",
                    "tool_call_id": call_id,
                    "content": output_str.trim_end()
                }));
            }
            // Ignore "reasoning" and other types
        }
    }

    json!(messages)
}

pub fn chat_delta_to_responses_sse(delta: &Value, is_first: &mut bool, text_acc: &mut String, model: &str) -> String {
    let mut out = String::new();
    if *is_first {
        *is_first = false;
        let created = json!({
            "type": "response.created",
            "response": {
                "id": "resp_1",
                "object": "response",
                "status": "in_progress",
                "model": model,
                "output": []
            }
        });
        out.push_str(&format!("event: response.created\ndata: {}\n\n", created));

        let item_added = json!({
            "type": "response.output_item.added",
            "output_index": 0,
            "item": {
                "id": "item_1",
                "type": "message",
                "role": "assistant",
                "status": "in_progress",
                "content": []
            }
        });
        out.push_str(&format!("event: response.output_item.added\ndata: {}\n\n", item_added));
    }

    if let Some(choices) = delta.get("choices").and_then(|c| c.as_array()) {
        if let Some(choice) = choices.get(0) {
            if let Some(delta_obj) = choice.get("delta") {
                if let Some(content) = delta_obj.get("content").and_then(|c| c.as_str()) {
                    if !content.is_empty() {
                        text_acc.push_str(content);
                        let delta_ev = json!({
                            "type": "response.output_text.delta",
                            "item_id": "item_1",
                            "output_index": 0,
                            "content_index": 0,
                            "delta": content
                        });
                        out.push_str(&format!("event: response.output_text.delta\ndata: {}\n\n", delta_ev));
                    }
                }
            }
        }
    }
    out
}

#[allow(dead_code)]
pub fn build_responses_completed_events(text_acc: &str, model: &str) -> String {
    let mut out = String::new();
    let item = json!({
        "id": "item_1",
        "type": "message",
        "role": "assistant",
        "status": "completed",
        "content": [
            {
                "type": "output_text",
                "text": text_acc
            }
        ]
    });
    
    let item_done = json!({
        "type": "response.output_item.done",
        "output_index": 0,
        "item": item
    });
    out.push_str(&format!("event: response.output_item.done\ndata: {}\n\n", item_done));
    
    let response = json!({
        "id": "resp_1",
        "object": "response",
        "status": "completed",
        "model": model,
        "output": [item]
    });
    let completed = json!({
        "type": "response.completed",
        "response": response
    });
    out.push_str(&format!("event: response.completed\ndata: {}\n\n", completed));
    
    out.push_str("data: [DONE]\n\n");
    out
}

#[allow(dead_code)]
pub fn build_responses_failed_event(error_msg: &str, model: &str) -> String {
    let mut out = String::new();
    let failed = json!({
        "type": "response.failed",
        "response": {
            "id": "resp_1",
            "object": "response",
            "status": "failed",
            "model": model,
            "error": {
                "type": "server_error",
                "code": "upstream_error",
                "message": error_msg
            }
        }
    });
    out.push_str(&format!("event: response.failed\ndata: {}\n\n", failed));
    out.push_str("data: [DONE]\n\n");
    out
}

#[allow(dead_code)]
pub fn responses_tools_to_chat_tools(tools: Option<&Value>) -> Option<Value> {
    if let Some(arr) = tools.and_then(|t| t.as_array()) {
        if arr.is_empty() {
            return None;
        }
        let mut chat_tools = Vec::new();
        for t in arr {
            if t.get("type").and_then(|v| v.as_str()) != Some("function") {
                continue;
            }
            if let Some(func) = t.get("function") {
                if func.get("name").is_some() {
                    chat_tools.push(json!({
                        "type": "function",
                        "function": func
                    }));
                }
            } else if let Some(name) = t.get("name").and_then(|v| v.as_str()) {
                chat_tools.push(json!({
                    "type": "function",
                    "function": {
                        "name": name,
                        "description": t.get("description"),
                        "parameters": t.get("parameters").or_else(|| t.get("input_schema")).unwrap_or(&json!({"type": "object"}))
                    }
                }));
            }
        }
        if chat_tools.is_empty() {
            None
        } else {
            Some(json!(chat_tools))
        }
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_responses_input_to_chat_messages() {
        let input = json!({});
        let output = responses_input_to_chat_messages(&input, None);
        assert_eq!(output, json!([]));
    }

    #[test]
    fn test_chat_delta_to_responses_sse() {
        let delta = json!({});
        let mut is_first = true;
        let mut text_acc = String::new();
        let output = chat_delta_to_responses_sse(&delta, &mut is_first, &mut text_acc, "test-model");
        assert!(output.contains("response.created"));
        assert!(output.contains("response.output_item.added"));
    }

    #[test]
    fn test_responses_tools_to_chat_tools() {
        let tools = json!({});
        let output = responses_tools_to_chat_tools(&tools);
        assert_eq!(output, json!([]));
    }
}
