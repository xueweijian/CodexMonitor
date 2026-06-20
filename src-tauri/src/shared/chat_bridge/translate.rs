use serde_json::{json, Value};

pub fn responses_input_to_chat_messages(_input: &Value) -> Value {
    json!([])
}

pub fn chat_delta_to_responses_sse(_delta: &Value) -> String {
    String::new()
}

pub fn responses_tools_to_chat_tools(_tools: &Value) -> Value {
    json!([])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_responses_input_to_chat_messages() {
        let input = json!({});
        let output = responses_input_to_chat_messages(&input);
        assert_eq!(output, json!([]));
    }

    #[test]
    fn test_chat_delta_to_responses_sse() {
        let delta = json!({});
        let output = chat_delta_to_responses_sse(&delta);
        assert_eq!(output, "");
    }

    #[test]
    fn test_responses_tools_to_chat_tools() {
        let tools = json!({});
        let output = responses_tools_to_chat_tools(&tools);
        assert_eq!(output, json!([]));
    }
}
