import { useEffect, useMemo, useRef } from "react";
import Stethoscope from "lucide-react/dist/esm/icons/stethoscope";
import type { Dispatch, SetStateAction } from "react";
import type {
  AppSettings,
  CodexDoctorResult,
  CodexUpdateResult,
  ModelOption,
} from "@/types";
import {
  SettingsSection,
  SettingsToggleRow,
} from "@/features/design-system/components/settings/SettingsPrimitives";
import { FileEditorCard } from "@/features/shared/components/FileEditorCard";
import { SettingsProviderSection } from "./SettingsProviderSection";
import { useTranslation, Trans } from "react-i18next";

type SettingsCodexSectionProps = {
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  defaultModels: ModelOption[];
  defaultModelsLoading: boolean;
  defaultModelsError: string | null;
  defaultModelsConnectedWorkspaceCount: number;
  onRefreshDefaultModels: () => void;
  codexPathDraft: string;
  codexArgsDraft: string;
  codexDirty: boolean;
  isSavingSettings: boolean;
  doctorState: {
    status: "idle" | "running" | "done";
    result: CodexDoctorResult | null;
  };
  codexUpdateState: {
    status: "idle" | "running" | "done";
    result: CodexUpdateResult | null;
  };
  globalAgentsMeta: string;
  globalAgentsError: string | null;
  globalAgentsContent: string;
  globalAgentsLoading: boolean;
  globalAgentsRefreshDisabled: boolean;
  globalAgentsSaveDisabled: boolean;
  globalAgentsSaveLabel: string;
  globalConfigMeta: string;
  globalConfigError: string | null;
  globalConfigContent: string;
  globalConfigLoading: boolean;
  globalConfigRefreshDisabled: boolean;
  globalConfigSaveDisabled: boolean;
  globalConfigSaveLabel: string;
  onSetCodexPathDraft: Dispatch<SetStateAction<string>>;
  onSetCodexArgsDraft: Dispatch<SetStateAction<string>>;
  onSetGlobalAgentsContent: (value: string) => void;
  onSetGlobalConfigContent: (value: string) => void;
  onBrowseCodex: () => Promise<void>;
  onSaveCodexSettings: () => Promise<void>;
  onRunDoctor: () => Promise<void>;
  onRunCodexUpdate: () => Promise<void>;
  onRefreshGlobalAgents: () => void;
  onSaveGlobalAgents: () => void;
  onRefreshGlobalConfig: () => void;
  onSaveGlobalConfig: () => void;
};

const DEFAULT_REASONING_EFFORT = "medium";

const normalizeEffortValue = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
};

function coerceSavedModelSlug(value: string | null, models: ModelOption[]): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return null;
  }
  const bySlug = models.find((model) => model.model === trimmed);
  if (bySlug) {
    return bySlug.model;
  }
  const byId = models.find((model) => model.id === trimmed);
  return byId ? byId.model : null;
}

const getReasoningSupport = (model: ModelOption | null): boolean => {
  if (!model) {
    return false;
  }
  return model.supportedReasoningEfforts.length > 0 || model.defaultReasoningEffort !== null;
};

const getReasoningOptions = (model: ModelOption | null): string[] => {
  if (!model) {
    return [];
  }
  const supported = model.supportedReasoningEfforts
    .map((effort) => normalizeEffortValue(effort.reasoningEffort))
    .filter((effort): effort is string => Boolean(effort));
  if (supported.length > 0) {
    return Array.from(new Set(supported));
  }
  const fallback = normalizeEffortValue(model.defaultReasoningEffort);
  return fallback ? [fallback] : [];
};

export function SettingsCodexSection({
  appSettings,
  onUpdateAppSettings,
  defaultModels,
  defaultModelsLoading,
  defaultModelsError,
  defaultModelsConnectedWorkspaceCount,
  onRefreshDefaultModels,
  codexPathDraft,
  codexArgsDraft,
  codexDirty,
  isSavingSettings,
  doctorState,
  codexUpdateState,
  globalAgentsMeta,
  globalAgentsError,
  globalAgentsContent,
  globalAgentsLoading,
  globalAgentsRefreshDisabled,
  globalAgentsSaveDisabled,
  globalAgentsSaveLabel,
  globalConfigMeta,
  globalConfigError,
  globalConfigContent,
  globalConfigLoading,
  globalConfigRefreshDisabled,
  globalConfigSaveDisabled,
  globalConfigSaveLabel,
  onSetCodexPathDraft,
  onSetCodexArgsDraft,
  onSetGlobalAgentsContent,
  onSetGlobalConfigContent,
  onBrowseCodex,
  onSaveCodexSettings,
  onRunDoctor,
  onRunCodexUpdate,
  onRefreshGlobalAgents,
  onSaveGlobalAgents,
  onRefreshGlobalConfig,
  onSaveGlobalConfig,
}: SettingsCodexSectionProps) {
  const { t } = useTranslation("settings");
  const latestModelSlug = defaultModels[0]?.model ?? null;
  const savedModelSlug = useMemo(
    () => coerceSavedModelSlug(appSettings.lastComposerModelId, defaultModels),
    [appSettings.lastComposerModelId, defaultModels],
  );
  const selectedModelSlug = savedModelSlug ?? latestModelSlug ?? "";
  const selectedModel = useMemo(
    () => defaultModels.find((model) => model.model === selectedModelSlug) ?? null,
    [defaultModels, selectedModelSlug],
  );
  const reasoningSupported = useMemo(
    () => getReasoningSupport(selectedModel),
    [selectedModel],
  );
  const reasoningOptions = useMemo(
    () => getReasoningOptions(selectedModel),
    [selectedModel],
  );
  const savedEffort = useMemo(
    () => normalizeEffortValue(appSettings.lastComposerReasoningEffort),
    [appSettings.lastComposerReasoningEffort],
  );
  const selectedEffort = useMemo(() => {
    if (!reasoningSupported) {
      return "";
    }
    if (savedEffort && reasoningOptions.includes(savedEffort)) {
      return savedEffort;
    }
    if (reasoningOptions.includes(DEFAULT_REASONING_EFFORT)) {
      return DEFAULT_REASONING_EFFORT;
    }
    const fallback = normalizeEffortValue(selectedModel?.defaultReasoningEffort);
    if (fallback && reasoningOptions.includes(fallback)) {
      return fallback;
    }
    return reasoningOptions[0] ?? "";
  }, [reasoningOptions, reasoningSupported, savedEffort, selectedModel]);

  const didNormalizeDefaultsRef = useRef(false);
  useEffect(() => {
    if (didNormalizeDefaultsRef.current) {
      return;
    }
    if (!defaultModels.length) {
      return;
    }
    const savedRawModel = (appSettings.lastComposerModelId ?? "").trim();
    const savedRawEffort = (appSettings.lastComposerReasoningEffort ?? "").trim();
    const shouldNormalizeModel = savedRawModel.length === 0 || savedModelSlug === null;
    const shouldNormalizeEffort =
      reasoningSupported &&
      (savedRawEffort.length === 0 ||
        savedEffort === null ||
        !reasoningOptions.includes(savedEffort));
    if (!shouldNormalizeModel && !shouldNormalizeEffort) {
      didNormalizeDefaultsRef.current = true;
      return;
    }

    const next: AppSettings = {
      ...appSettings,
      lastComposerModelId: shouldNormalizeModel ? selectedModelSlug : appSettings.lastComposerModelId,
      lastComposerReasoningEffort: shouldNormalizeEffort
        ? selectedEffort
        : appSettings.lastComposerReasoningEffort,
    };
    didNormalizeDefaultsRef.current = true;
    void onUpdateAppSettings(next);
  }, [
    appSettings,
    defaultModels.length,
    onUpdateAppSettings,
    reasoningOptions,
    reasoningSupported,
    savedEffort,
    savedModelSlug,
    selectedModelSlug,
    selectedEffort,
  ]);

  return (
    <SettingsSection
      title={t("codex.title")}
      subtitle={t("codex.subtitle")}
    >
      <SettingsProviderSection
        settings={appSettings}
        updateSettings={(partial) => onUpdateAppSettings({ ...appSettings, ...partial })}
      />
      <div className="settings-field mt-8">
        <label className="settings-field-label" htmlFor="codex-path">
          {t("codex.default_path")}
        </label>
        <div className="settings-field-row">
          <input
            id="codex-path"
            className="settings-input"
            value={codexPathDraft}
            placeholder={t("codex.placeholder_path")}
            onChange={(event) => onSetCodexPathDraft(event.target.value)}
          />
          <button
            type="button"
            className="ghost"
            onClick={() => {
              void onBrowseCodex();
            }}
          >
            {t("codex.btn_browse")}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => onSetCodexPathDraft("")}
          >
            {t("codex.btn_use_path")}
          </button>
        </div>
        <div className="settings-help">{t("codex.default_path_sub")}</div>
        <label className="settings-field-label" htmlFor="codex-args">
          {t("codex.default_args")}
        </label>
        <div className="settings-field-row">
          <input
            id="codex-args"
            className="settings-input"
            value={codexArgsDraft}
            placeholder={t("codex.placeholder_args")}
            onChange={(event) => onSetCodexArgsDraft(event.target.value)}
          />
          <button
            type="button"
            className="ghost"
            onClick={() => onSetCodexArgsDraft("")}
          >
            {t("codex.btn_clear")}
          </button>
        </div>
        <div className="settings-help">
          <Trans t={t} i18nKey="codex.default_args_sub">
            Extra flags passed before <code>app-server</code>. Use quotes for values with spaces.
          </Trans>
        </div>
        <div className="settings-help">
          {t("codex.default_args_sub2")}
        </div>
        <div className="settings-help">
          <Trans t={t} i18nKey="codex.default_args_sub3">
            Per-thread override processing ignores unsupported flags: <code>-m</code>/
            <code>--model</code>, <code>-a</code>/<code>--ask-for-approval</code>,{" "}
            <code>-s</code>/<code>--sandbox</code>, <code>--full-auto</code>,{" "}
            <code>--dangerously-bypass-approvals-and-sandbox</code>, <code>--oss</code>,{" "}
            <code>--local-provider</code>, and <code>--no-alt-screen</code>.
          </Trans>
        </div>
        <div className="settings-field-actions">
          {codexDirty && (
            <button
              type="button"
              className="primary"
              onClick={() => {
                void onSaveCodexSettings();
              }}
              disabled={isSavingSettings}
            >
              {isSavingSettings ? t("codex.saving") : t("codex.btn_save")}
            </button>
          )}
          <button
            type="button"
            className="ghost settings-button-compact"
            onClick={() => {
              void onRunDoctor();
            }}
            disabled={doctorState.status === "running"}
          >
            <Stethoscope aria-hidden />
            {doctorState.status === "running" ? t("codex.running") : t("codex.btn_doctor")}
          </button>
          <button
            type="button"
            className="ghost settings-button-compact"
            onClick={() => {
              void onRunCodexUpdate();
            }}
            disabled={codexUpdateState.status === "running"}
            title={t("codex.btn_update_tooltip")}
          >
            <Stethoscope aria-hidden />
            {codexUpdateState.status === "running" ? t("codex.updating") : t("codex.btn_update")}
          </button>
        </div>

        {doctorState.result && (
          <div className={`settings-doctor ${doctorState.result.ok ? "ok" : "error"}`}>
            <div className="settings-doctor-title">
              {doctorState.result.ok ? t("codex.doctor_ok") : t("codex.doctor_fail")}
            </div>
            <div className="settings-doctor-body">
              <div>{t("codex.doctor_version", { version: doctorState.result.version ?? t("about.unknown") })}</div>
              <div>{t("codex.doctor_app_server", { status: doctorState.result.appServerOk ? "ok" : "failed" })}</div>
              <div>
                {t("codex.doctor_node", {
                  status: doctorState.result.nodeOk
                    ? t("codex.doctor_node_ok", { version: doctorState.result.nodeVersion ?? t("about.unknown") })
                    : t("codex.doctor_node_missing")
                })}
              </div>
              {doctorState.result.details && <div>{doctorState.result.details}</div>}
              {doctorState.result.nodeDetails && <div>{doctorState.result.nodeDetails}</div>}
              {doctorState.result.path && (
                <div className="settings-doctor-path">PATH: {doctorState.result.path}</div>
              )}
            </div>
          </div>
        )}

        {codexUpdateState.result && (
          <div
            className={`settings-doctor ${codexUpdateState.result.ok ? "ok" : "error"}`}
          >
            <div className="settings-doctor-title">
              {codexUpdateState.result.ok
                ? codexUpdateState.result.upgraded
                  ? t("codex.update_ok")
                  : t("codex.update_latest")
                : t("codex.update_fail")}
            </div>
            <div className="settings-doctor-body">
              <div>{t("codex.update_method", { method: codexUpdateState.result.method })}</div>
              {codexUpdateState.result.package && (
                <div>{t("codex.update_package", { package: codexUpdateState.result.package })}</div>
              )}
              <div>
                {t("codex.doctor_version", {
                  version: codexUpdateState.result.afterVersion ??
                    codexUpdateState.result.beforeVersion ??
                    t("about.unknown")
                })}
              </div>
              {codexUpdateState.result.details && <div>{codexUpdateState.result.details}</div>}
              {codexUpdateState.result.output && (
                <details>
                  <summary>{t("codex.update_output")}</summary>
                  <pre>{codexUpdateState.result.output}</pre>
                </details>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="settings-divider" />
      <div className="settings-field-label settings-field-label--section">
        {t("codex.default_params")}
      </div>

      <SettingsToggleRow
        title={
          <label htmlFor="default-model">
            {t("codex.model")}
          </label>
        }
        subtitle={
          defaultModelsConnectedWorkspaceCount === 0
            ? t("codex.models_add_workspace")
            : defaultModelsLoading
              ? t("codex.models_loading")
              : defaultModelsError
                ? t("codex.models_error", { error: defaultModelsError })
                : t("codex.model_sub")
        }
      >
        <div className="settings-field-row">
          <select
            id="default-model"
            className="settings-select"
            value={selectedModelSlug}
            disabled={!defaultModels.length || defaultModelsLoading}
            onChange={(event) =>
              void onUpdateAppSettings({
                ...appSettings,
                lastComposerModelId: event.target.value,
              })
            }
            aria-label={t("codex.model")}
          >
            {defaultModels.map((model) => (
              <option key={model.model} value={model.model}>
                {model.displayName?.trim() || model.model}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="ghost"
            onClick={onRefreshDefaultModels}
            disabled={defaultModelsLoading || defaultModelsConnectedWorkspaceCount === 0}
          >
            {t("agents.btn_refresh")}
          </button>
        </div>
      </SettingsToggleRow>

      <SettingsToggleRow
        title={
          <label htmlFor="default-effort">
            {t("codex.reasoning")}
          </label>
        }
        subtitle={
          reasoningSupported
            ? t("codex.reasoning_sub")
            : t("codex.reasoning_none")
        }
      >
        <select
          id="default-effort"
          className="settings-select"
          value={selectedEffort}
          onChange={(event) =>
            void onUpdateAppSettings({
              ...appSettings,
              lastComposerReasoningEffort: event.target.value,
            })
          }
          aria-label={t("codex.reasoning")}
          disabled={!reasoningSupported}
        >
          {!reasoningSupported && <option value="">{t("codex.option_reasoning_not_supported")}</option>}
          {reasoningOptions.map((effort) => (
            <option key={effort} value={effort}>
              {effort}
            </option>
          ))}
        </select>
      </SettingsToggleRow>

      <SettingsToggleRow
        title={
          <label htmlFor="default-access">
            {t("codex.access_mode")}
          </label>
        }
        subtitle={t("codex.access_mode_sub")}
      >
        <select
          id="default-access"
          className="settings-select"
          value={appSettings.defaultAccessMode}
          onChange={(event) =>
            void onUpdateAppSettings({
              ...appSettings,
              defaultAccessMode: event.target.value as AppSettings["defaultAccessMode"],
            })
          }
        >
          <option value="read-only">{t("codex.option_access_readonly")}</option>
          <option value="current">{t("codex.option_access_onrequest")}</option>
          <option value="full-access">{t("codex.option_access_full")}</option>
        </select>
      </SettingsToggleRow>
      <div className="settings-field">
        <label className="settings-field-label" htmlFor="review-delivery">
          {t("codex.review_mode")}
        </label>
        <select
          id="review-delivery"
          className="settings-select"
          value={appSettings.reviewDeliveryMode}
          onChange={(event) =>
            void onUpdateAppSettings({
              ...appSettings,
              reviewDeliveryMode: event.target.value as AppSettings["reviewDeliveryMode"],
            })
          }
        >
          <option value="inline">{t("codex.option_review_inline")}</option>
          <option value="detached">{t("codex.option_review_detached")}</option>
        </select>
        <div className="settings-help">
          <Trans t={t} i18nKey="codex.review_mode_sub">
            Choose whether <code>/review</code> runs in the current thread or a detached review
            thread.
          </Trans>
        </div>
      </div>

      <FileEditorCard
        title="Global AGENTS.md"
        meta={globalAgentsMeta}
        error={globalAgentsError}
        value={globalAgentsContent}
        placeholder={t("codex.placeholder_global_instructions")}
        disabled={globalAgentsLoading}
        refreshDisabled={globalAgentsRefreshDisabled}
        saveDisabled={globalAgentsSaveDisabled}
        saveLabel={globalAgentsSaveLabel}
        onChange={onSetGlobalAgentsContent}
        onRefresh={onRefreshGlobalAgents}
        onSave={onSaveGlobalAgents}
        refreshTooltip={t("agents.btn_refresh")}
        saveAriaLabel={globalAgentsSaveLabel === t("codex.btn_create") ? `${t("codex.btn_create")} AGENTS.md` : `${t("codex.btn_save")} AGENTS.md`}
        helpText={
          <Trans t={t} i18nKey="codex.help_agents_md">
            Stored at <code>~/.codex/AGENTS.md</code>.
          </Trans>
        }
        classNames={{
          container: "settings-field settings-agents",
          header: "settings-agents-header",
          title: "settings-field-label",
          actions: "settings-agents-actions",
          meta: "settings-help settings-help-inline",
          iconButton: "ghost settings-icon-button",
          error: "settings-agents-error",
          textarea: "settings-agents-textarea",
          help: "settings-help",
        }}
      />

      <FileEditorCard
        title="Global config.toml"
        meta={globalConfigMeta}
        error={globalConfigError}
        value={globalConfigContent}
        placeholder={t("codex.placeholder_global_config")}
        disabled={globalConfigLoading}
        refreshDisabled={globalConfigRefreshDisabled}
        saveDisabled={globalConfigSaveDisabled}
        saveLabel={globalConfigSaveLabel}
        onChange={onSetGlobalConfigContent}
        onRefresh={onRefreshGlobalConfig}
        onSave={onSaveGlobalConfig}
        refreshTooltip={t("agents.btn_refresh")}
        saveAriaLabel={globalConfigSaveLabel === t("codex.btn_create") ? `${t("codex.btn_create")} config.toml` : `${t("codex.btn_save")} config.toml`}
        helpText={
          <Trans t={t} i18nKey="codex.help_config_toml">
            Stored at <code>~/.codex/config.toml</code>.
          </Trans>
        }
        classNames={{
          container: "settings-field settings-agents",
          header: "settings-agents-header",
          title: "settings-field-label",
          actions: "settings-agents-actions",
          meta: "settings-help settings-help-inline",
          iconButton: "ghost settings-icon-button",
          error: "settings-agents-error",
          textarea: "settings-agents-textarea",
          help: "settings-help",
        }}
      />
    </SettingsSection>
  );
}
