import { useState } from "react";
import { AppSettings, ThirdPartyProvider } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";

interface SettingsProviderSectionProps {
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

export function SettingsProviderSection({ settings, updateSettings }: SettingsProviderSectionProps) {
  const { t } = useTranslation(["settings", "common"]);
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
    setTestResult(t("provider.testing"));
    try {
      const success = await invoke("test_provider_connection", {
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey || "",
      });
      setTestResult(success ? t("provider.success") : t("provider.failed"));
    } catch (e: any) {
      setTestResult(t("error", { ns: "common" }) + ": " + e.toString());
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="settings-checkbox">
        <input
          type="checkbox"
          id="useThirdPartyProvider"
          checked={settings.useThirdPartyProvider}
          onChange={(e) => updateSettings({ useThirdPartyProvider: e.target.checked })}
        />
        {t("provider.enable")}
      </label>

      {settings.useThirdPartyProvider && (
        <div className="flex flex-col gap-4 pl-6 border-l-2 border-gray-200">
          <div className="settings-field">
            <label className="settings-field-label" htmlFor="providerName">
              {t("provider.name")}
            </label>
            <div className="settings-field-row">
              <input
                id="providerName"
                className="settings-input"
                value={provider.providerName}
                onChange={(e) => handleChange("providerName", e.target.value)}
                placeholder={t("provider.name_placeholder")}
              />
            </div>
          </div>

          <div className="settings-field">
            <label className="settings-field-label" htmlFor="providerBaseUrl">
              {t("provider.base_url")}
            </label>
            <div className="settings-field-row">
              <input
                id="providerBaseUrl"
                className="settings-input"
                value={provider.baseUrl}
                onChange={(e) => handleChange("baseUrl", e.target.value)}
                placeholder={t("provider.base_url_placeholder")}
              />
            </div>
          </div>

          <div className="settings-field">
            <label className="settings-field-label" htmlFor="providerApiKey">
              {t("provider.api_key")}
            </label>
            <div className="settings-field-row">
              <input
                id="providerApiKey"
                type="password"
                className="settings-input"
                value={provider.apiKey || ""}
                onChange={(e) => handleChange("apiKey", e.target.value)}
                placeholder={t("provider.api_key_placeholder")}
              />
            </div>
          </div>

          <div className="settings-field">
            <label className="settings-field-label" htmlFor="providerModel">
              {t("provider.model")}
            </label>
            <div className="settings-field-row">
              <input
                id="providerModel"
                className="settings-input"
                value={provider.model}
                onChange={(e) => handleChange("model", e.target.value)}
                placeholder={t("provider.model_placeholder")}
              />
            </div>
          </div>

          <div className="settings-field">
            <label className="settings-field-label" htmlFor="providerWireApi">
              {t("provider.protocol")}
            </label>
            <div className="settings-field-row">
              <select
                id="providerWireApi"
                className="settings-select"
                value={provider.wireApi}
                onChange={(e) => handleChange("wireApi", e.target.value)}
              >
                <option value="chat">{t("provider.protocol_chat")}</option>
                <option value="responses">{t("provider.protocol_responses")}</option>
              </select>
            </div>
          </div>

          <div className="settings-field-actions">
            <button
              type="button"
              onClick={handleTestConnection}
              className="primary"
            >
              {t("provider.test_connection")}
            </button>
            {testResult && <span className="text-sm text-gray-600">{testResult}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
