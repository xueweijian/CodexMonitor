import { useState } from "react";
import { AppSettings, ThirdPartyProvider } from "@/types";
import { invoke } from "@tauri-apps/api/core";

interface SettingsProviderSectionProps {
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

export function SettingsProviderSection({ settings, updateSettings }: SettingsProviderSectionProps) {
  const [testResult, setTestResult] = useState<string | null>(null);

  const provider = settings.thirdPartyProvider || {
    providerName: "",
    baseUrl: "",
    apiKey: "",
    model: "",
    wireApi: "chat",
  };

  const handleChange = (field: keyof ThirdPartyProvider, value: string) => {
    updateSettings({
      thirdPartyProvider: {
        ...provider,
        [field]: value,
      },
    });
  };

  const handleTestConnection = async () => {
    setTestResult("Testing...");
    try {
      const success = await invoke("test_provider_connection", {
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey || "",
      });
      setTestResult(success ? "Success" : "Failed to connect");
    } catch (e: any) {
      setTestResult("Error: " + e.toString());
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="useThirdPartyProvider"
          checked={settings.useThirdPartyProvider}
          onChange={(e) => updateSettings({ useThirdPartyProvider: e.target.checked })}
        />
        <label htmlFor="useThirdPartyProvider" className="font-medium">
          Enable Third-Party Model Provider
        </label>
      </div>

      {settings.useThirdPartyProvider && (
        <div className="flex flex-col gap-4 pl-6 border-l-2 border-gray-200">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Provider Name</label>
            <input
              className="p-2 border rounded"
              value={provider.providerName}
              onChange={(e) => handleChange("providerName", e.target.value)}
              placeholder="e.g. DeepSeek"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">API Base URL</label>
            <input
              className="p-2 border rounded"
              value={provider.baseUrl}
              onChange={(e) => handleChange("baseUrl", e.target.value)}
              placeholder="https://api.deepseek.com/v1"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">API Key</label>
            <input
              type="password"
              className="p-2 border rounded"
              value={provider.apiKey || ""}
              onChange={(e) => handleChange("apiKey", e.target.value)}
              placeholder="sk-..."
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Default Model</label>
            <input
              className="p-2 border rounded"
              value={provider.model}
              onChange={(e) => handleChange("model", e.target.value)}
              placeholder="e.g. deepseek-chat"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Protocol Mode</label>
            <select
              className="p-2 border rounded bg-white"
              value={provider.wireApi}
              onChange={(e) => handleChange("wireApi", e.target.value)}
            >
              <option value="chat">Chat Completions API</option>
              <option value="responses">Responses API</option>
            </select>
          </div>

          <div className="flex gap-2 items-center mt-2">
            <button
              onClick={handleTestConnection}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Test Connection
            </button>
            {testResult && <span className="text-sm text-gray-600">{testResult}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
