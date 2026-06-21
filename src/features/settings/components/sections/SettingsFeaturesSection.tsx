import { useTranslation, Trans } from "react-i18next";
import type { CodexFeature } from "@/types";
import {
  SettingsSection,
  SettingsSubsection,
  SettingsToggleRow,
  SettingsToggleSwitch,
} from "@/features/design-system/components/settings/SettingsPrimitives";
import type { SettingsFeaturesSectionProps } from "@settings/hooks/useSettingsFeaturesSection";
import { fileManagerName, openInFileManagerLabel } from "@utils/platformPaths";

const FEATURE_KEY_MAP: Record<string, string> = {
  undo: "desc_ghost_commit",
  shell_tool: "desc_shell",
  unified_exec: "desc_pty_exec",
  shell_snapshot: "desc_shell_snapshot",
  js_repl: "desc_js_repl",
  js_repl_tools_only: "desc_js_repl_only",
  web_search_request: "desc_search_dep",
  web_search_cached: "desc_search_dep",
  search_tool: "desc_search_rem",
  runtime_metrics: "desc_metrics",
  sqlite: "desc_rollout",
  memory_tool: "desc_memory",
  child_agents_md: "desc_agents_md",
  apply_patch_freeform: "desc_apply_patch",
  use_linux_sandbox_bwrap: "desc_linux_sandbox",
  request_rule: "desc_approvals",
  experimental_windows_sandbox: "desc_win_sandbox",
  elevated_windows_sandbox: "desc_win_sandbox_elevated",
  remote_models: "desc_refresh_models",
  powershell_utf8: "desc_powershell_utf8",
  enable_request_compression: "desc_compress_streaming",
  apps: "desc_chatgpt_apps",
  apps_mcp_gateway: "desc_apps_mcp",
  skill_mcp_dependency_install: "desc_mcp_dep",
  skill_env_var_dependency_prompt: "desc_skill_env",
  steer: "desc_turn_steering",
  collaboration_modes: "desc_collab_presets",
  personality: "desc_personality",
  responses_websockets: "desc_responses_ws",
  responses_websockets_v2: "desc_responses_ws_v2",
};

function formatFeatureLabel(feature: CodexFeature): string {
  const displayName = feature.displayName?.trim();
  if (displayName) {
    return displayName;
  }
  return feature.name
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function featureSubtitle(feature: CodexFeature, t: any): string {
  if (feature.description?.trim()) {
    return feature.description;
  }
  if (feature.announcement?.trim()) {
    return feature.announcement;
  }
  const key = FEATURE_KEY_MAP[feature.name];
  if (key) {
    return t(`features.${key}`);
  }
  if (feature.stage === "deprecated") {
    return t("features.desc_deprecated");
  }
  if (feature.stage === "removed") {
    return t("features.desc_legacy");
  }
  return t("features.feature_key", { name: feature.name, defaultValue: `Feature key: features.${feature.name}` });
}

export function SettingsFeaturesSection({
  appSettings,
  hasFeatureWorkspace,
  openConfigError,
  featureError,
  featuresLoading,
  featureUpdatingKey,
  stableFeatures,
  experimentalFeatures,
  hasDynamicFeatureRows,
  onOpenConfig,
  onToggleCodexFeature,
  onUpdateAppSettings,
}: SettingsFeaturesSectionProps) {
  const { t } = useTranslation("settings");

  return (
    <SettingsSection
      title={t("features.title")}
      subtitle={t("features.subtitle")}
    >
      <SettingsToggleRow
        title={t("features.config_file")}
        subtitle={t("features.open_config_sub", {
          fileManager: fileManagerName(),
          defaultValue: `Open the Codex config in ${fileManagerName()}.`,
        })}
      >
        <button type="button" className="ghost" onClick={onOpenConfig}>
          {openInFileManagerLabel()}
        </button>
      </SettingsToggleRow>
      {openConfigError && <div className="settings-help">{openConfigError}</div>}
      <SettingsSubsection
        title={t("features.sub_stable")}
        subtitle={t("features.sub_stable_sub")}
      />
      <SettingsToggleRow
        title={t("features.personality")}
        subtitle={
          <Trans t={t} i18nKey="features.personality_sub">
            Choose Codex communication style (writes top-level <code>personality</code> in
            config.toml).
          </Trans>
        }
      >
        <select
          id="features-personality-select"
          className="settings-select"
          value={appSettings.personality}
          onChange={(event) =>
            void onUpdateAppSettings({
              ...appSettings,
              personality: event.target.value as (typeof appSettings)["personality"],
            })
          }
          aria-label={t("features.personality")}
        >
          <option value="friendly">{t("features.opt_friendly")}</option>
          <option value="pragmatic">{t("features.opt_pragmatic")}</option>
        </select>
      </SettingsToggleRow>
      <SettingsToggleRow
        title={t("features.pause_queued")}
        subtitle={t("features.pause_queued_sub")}
      >
        <SettingsToggleSwitch
          pressed={appSettings.pauseQueuedMessagesWhenResponseRequired}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              pauseQueuedMessagesWhenResponseRequired:
                !appSettings.pauseQueuedMessagesWhenResponseRequired,
            })
          }
        />
      </SettingsToggleRow>
      {stableFeatures.map((feature) => (
        <SettingsToggleRow
          key={feature.name}
          title={formatFeatureLabel(feature)}
          subtitle={featureSubtitle(feature, t)}
        >
          <SettingsToggleSwitch
            pressed={feature.enabled}
            onClick={() => onToggleCodexFeature(feature)}
            disabled={featureUpdatingKey === feature.name}
          />
        </SettingsToggleRow>
      ))}
      {hasFeatureWorkspace &&
        !featuresLoading &&
        !featureError &&
        stableFeatures.length === 0 && (
        <div className="settings-help">{t("features.no_stable")}</div>
      )}
      <SettingsSubsection
        title={t("features.sub_experimental")}
        subtitle={t("features.sub_experimental_sub")}
      />
      {experimentalFeatures.map((feature) => (
        <SettingsToggleRow
          key={feature.name}
          title={formatFeatureLabel(feature)}
          subtitle={featureSubtitle(feature, t)}
        >
          <SettingsToggleSwitch
            pressed={feature.enabled}
            onClick={() => onToggleCodexFeature(feature)}
            disabled={featureUpdatingKey === feature.name}
          />
        </SettingsToggleRow>
      ))}
      {hasFeatureWorkspace &&
        !featuresLoading &&
        !featureError &&
        hasDynamicFeatureRows &&
        experimentalFeatures.length === 0 && (
          <div className="settings-help">
            {t("features.no_experimental")}
          </div>
        )}
      {featuresLoading && (
        <div className="settings-help">{t("features.loading")}</div>
      )}
      {!hasFeatureWorkspace && !featuresLoading && (
        <div className="settings-help">
          {t("features.connect_workspace")}
        </div>
      )}
      {featureError && <div className="settings-help">{featureError}</div>}
    </SettingsSection>
  );
}
