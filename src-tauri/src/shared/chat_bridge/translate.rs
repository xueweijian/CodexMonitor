use serde_json::{json, Value};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct ToolCallState {
    pub id: String,
    pub name: String,
    pub args_buf: String,
    pub item_id: String,
    pub output_index: u32,
    pub added: bool,
}

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

pub fn chat_delta_to_responses_sse(
    delta: &Value, 
    is_first: &mut bool, 
    text_acc: &mut String, 
    model: &str,
    tool_calls: &mut HashMap<usize, ToolCallState>,
    next_output_index: &mut u32
) -> String {
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
                
                if let Some(tc_arr) = delta_obj.get("tool_calls").and_then(|tc| tc.as_array()) {
                    for tc in tc_arr {
                        let idx = tc.get("index").and_then(|i| i.as_u64()).unwrap_or(0) as usize;
                        let entry = tool_calls.entry(idx).or_insert_with(|| ToolCallState {
                            id: tc.get("id").and_then(|i| i.as_str()).unwrap_or("").to_string(),
                            name: tc.get("function").and_then(|f| f.get("name")).and_then(|n| n.as_str()).unwrap_or("").to_string(),
                            args_buf: String::new(),
                            item_id: format!("fc_{}", uuid::Uuid::new_v4().to_string().replace("-", "")),
                            output_index: *next_output_index,
                            added: false,
                        });
                        
                        if entry.output_index == *next_output_index {
                            *next_output_index += 1;
                        }
                        
                        if let Some(id) = tc.get("id").and_then(|i| i.as_str()) {
                            if entry.id != id {
                                entry.id = id.to_string();
                            }
                        }
                        if let Some(name) = tc.get("function").and_then(|f| f.get("name")).and_then(|n| n.as_str()) {
                            entry.name = name.to_string();
                        }
                        
                        let announce = !entry.added && !entry.name.is_empty();
                        if announce {
                            let item_added = json!({
                                "type": "response.output_item.added",
                                "output_index": entry.output_index,
                                "item": {
                                    "id": entry.item_id,
                                    "type": "function_call",
                                    "call_id": entry.id,
                                    "name": entry.name,
                                    "arguments": ""
                                }
                            });
                            out.push_str(&format!("event: response.output_item.added\ndata: {}\n\n", item_added));
                            entry.added = true;
                        }
                        
                        if let Some(args) = tc.get("function").and_then(|f| f.get("arguments")).and_then(|a| a.as_str()) {
                            entry.args_buf.push_str(args);
                            if entry.added {
                                let arg_delta = json!({
                                    "type": "response.function_call_arguments.delta",
                                    "item_id": entry.item_id,
                                    "output_index": entry.output_index,
                                    "delta": args
                                });
                                out.push_str(&format!("event: response.function_call_arguments.delta\ndata: {}\n\n", arg_delta));
                            }
                        }
                    }
                }
            }
        }
    }
    out
}

#[allow(dead_code)]
pub fn build_responses_completed_events(text_acc: &str, model: &str, tool_calls: &mut HashMap<usize, ToolCallState>) -> String {
    let mut out = String::new();
    let mut output_arr = Vec::new();

    let msg_item = json!({
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
    
    // Sort tool calls by index to ensure deterministic order
    let mut tc_vec: Vec<_> = tool_calls.values_mut().collect();
    tc_vec.sort_by_key(|tc| tc.output_index);

    for tc in tc_vec {
        if !tc.added && !tc.name.is_empty() {
            let item_added = json!({
                "type": "response.output_item.added",
                "output_index": tc.output_index,
                "item": {
                    "id": tc.item_id,
                    "type": "function_call",
                    "call_id": tc.id,
                    "name": tc.name,
                    "arguments": ""
                }
            });
            out.push_str(&format!("event: response.output_item.added\ndata: {}\n\n", item_added));
            tc.added = true;
            if !tc.args_buf.is_empty() {
                let arg_delta = json!({
                    "type": "response.function_call_arguments.delta",
                    "item_id": tc.item_id,
                    "output_index": tc.output_index,
                    "delta": tc.args_buf
                });
                out.push_str(&format!("event: response.function_call_arguments.delta\ndata: {}\n\n", arg_delta));
            }
        }

        let tc_item = json!({
            "id": tc.item_id,
            "type": "function_call",
            "call_id": tc.id,
            "name": tc.name,
            "arguments": tc.args_buf
        });

        let item_done = json!({
            "type": "response.output_item.done",
            "output_index": tc.output_index,
            "item": tc_item.clone()
        });
        out.push_str(&format!("event: response.output_item.done\ndata: {}\n\n", item_done));
        
        output_arr.push(tc_item);
    }
    
    // Message item must be added to output array as well, typically at the beginning or end depending on standard,
    // usually message first.
    output_arr.insert(0, msg_item.clone());

    let msg_item_done = json!({
        "type": "response.output_item.done",
        "output_index": 0,
        "item": msg_item
    });
    out.push_str(&format!("event: response.output_item.done\ndata: {}\n\n", msg_item_done));
    
    let response = json!({
        "id": "resp_1",
        "object": "response",
        "status": "completed",
        "model": model,
        "output": output_arr
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
        let mut tool_calls = HashMap::new();
        let mut next_output_index = 1;
        let output = chat_delta_to_responses_sse(&delta, &mut is_first, &mut text_acc, "test-model", &mut tool_calls, &mut next_output_index);
        assert!(output.contains("response.created"));
        assert!(output.contains("response.output_item.added"));
    }

    #[test]
    fn test_responses_tools_to_chat_tools() {
        let tools = json!([
            {
                "type": "function",
                "function": {
                    "name": "test_func",
                    "description": "test desc",
                    "parameters": { "type": "object" }
                }
            }
        ]);
        let output = responses_tools_to_chat_tools(Some(&tools));
        assert_eq!(
            output,
            Some(json!([
                {
                    "type": "function",
                    "function": {
                        "name": "test_func",
                        "description": "test desc",
                        "parameters": { "type": "object" }
                    }
                }
            ]))
        );

        let output_none = responses_tools_to_chat_tools(None);
        assert_eq!(output_none, None);
    }
}
