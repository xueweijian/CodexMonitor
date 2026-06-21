import { useEffect, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import type { AppSettings } from "@/types";
import {
  getAppBuildType,
  isMobileRuntime,
  type AppBuildType,
} from "@services/tauri";
import { useUpdater } from "@/features/update/hooks/useUpdater";
import {
  SettingsSection,
  SettingsToggleRow,
  SettingsToggleSwitch,
} from "@/features/design-system/components/settings/SettingsPrimitives";

type SettingsAboutSectionProps = {
  appSettings: AppSettings;
  onToggleAutomaticAppUpdateChecks?: () => void;
};

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function SettingsAboutSection({
  appSettings,
  onToggleAutomaticAppUpdateChecks,
}: SettingsAboutSectionProps) {
  const { t } = useTranslation("settings");
  const [appBuildType, setAppBuildType] = useState<AppBuildType | "unknown">("unknown");
  const [updaterEnabled, setUpdaterEnabled] = useState(false);
  const { state: updaterState, checkForUpdates, startUpdate } = useUpdater({
    enabled: updaterEnabled,
    autoCheckOnMount: false,
  });

  useEffect(() => {
    let active = true;
    const loadBuildType = async () => {
      try {
        const value = await getAppBuildType();
        if (active) {
          setAppBuildType(value);
        }
      } catch {
        if (active) {
          setAppBuildType("unknown");
        }
      }
    };
    void loadBuildType();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const detectRuntime = async () => {
      try {
        const mobileRuntime = await isMobileRuntime();
        if (active) {
          setUpdaterEnabled(!mobileRuntime);
        }
      } catch {
        if (active) {
          // In non-Tauri previews we still want local desktop-like behavior.
          setUpdaterEnabled(true);
        }
      }
    };
    void detectRuntime();
    return () => {
      active = false;
    };
  }, []);

  const buildDateValue = __APP_BUILD_DATE__.trim();
  const parsedBuildDate = Date.parse(buildDateValue);
  const buildDateLabel = Number.isNaN(parsedBuildDate)
    ? buildDateValue || t("about.unknown")
    : new Date(parsedBuildDate).toLocaleString();

  const unknownLabel = t("about.unknown");

  return (
    <SettingsSection title={t("about.title")} subtitle={t("about.subtitle")}>
      <div className="settings-field">
        <div className="settings-help">
          <Trans t={t} i18nKey="about.version">
            Version: <code>{__APP_VERSION__}</code>
          </Trans>
        </div>
        <div className="settings-help">
          <Trans t={t} i18nKey="about.build_type">
            Build type: <code>{appBuildType === "unknown" ? unknownLabel : appBuildType}</code>
          </Trans>
        </div>
        <div className="settings-help">
          <Trans t={t} i18nKey="about.branch">
            Branch: <code>{__APP_GIT_BRANCH__ || unknownLabel}</code>
          </Trans>
        </div>
        <div className="settings-help">
          <Trans t={t} i18nKey="about.commit">
            Commit: <code>{__APP_COMMIT_HASH__ || unknownLabel}</code>
          </Trans>
        </div>
        <div className="settings-help">
          <Trans t={t} i18nKey="about.build_date">
            Build date: <code>{buildDateLabel}</code>
          </Trans>
        </div>
      </div>
      <div className="settings-field">
        <div className="settings-label">{t("about.app_updates")}</div>
        <SettingsToggleRow
          title={t("about.auto_check")}
          subtitle={t("about.auto_check_sub")}
        >
          <SettingsToggleSwitch
            pressed={appSettings.automaticAppUpdateChecksEnabled}
            onClick={() => {
              onToggleAutomaticAppUpdateChecks?.();
            }}
          />
        </SettingsToggleRow>
        <div className="settings-help">
          <Trans t={t} i18nKey="about.running_version" values={{ version: __APP_VERSION__ }}>
            Currently running version <code>{__APP_VERSION__}</code>
          </Trans>
        </div>
        {!updaterEnabled && (
          <div className="settings-help">
            {t("about.unavailable")}
          </div>
        )}

        {updaterState.stage === "error" && (
          <div className="settings-help ds-text-danger">
            {t("about.update_failed", { error: updaterState.error })}
          </div>
        )}

        {updaterState.stage === "downloading" ||
        updaterState.stage === "installing" ||
        updaterState.stage === "restarting" ? (
          <div className="settings-help">
            {updaterState.stage === "downloading" ? (
              <>
                {t("about.downloading", {
                  progress: updaterState.progress?.totalBytes
                    ? `${Math.round((updaterState.progress.downloadedBytes / updaterState.progress.totalBytes) * 100)}%`
                    : formatBytes(updaterState.progress?.downloadedBytes ?? 0),
                })}
              </>
            ) : updaterState.stage === "installing" ? (
              t("about.installing")
            ) : (
              t("about.restarting")
            )}
          </div>
        ) : updaterState.stage === "available" ? (
          <div className="settings-help">
            <Trans t={t} i18nKey="about.available" values={{ version: updaterState.version }}>
              Version <code>{updaterState.version}</code> is available.
            </Trans>
          </div>
        ) : updaterState.stage === "latest" ? (
          <div className="settings-help">{t("about.latest")}</div>
        ) : null}

        <div className="settings-controls">
          {updaterState.stage === "available" ? (
            <button
              type="button"
              className="primary"
              disabled={!updaterEnabled}
              onClick={() => void startUpdate()}
            >
              {t("about.download_install")}
            </button>
          ) : (
            <button
              type="button"
              className="ghost"
              disabled={
                !updaterEnabled ||
                updaterState.stage === "checking" ||
                updaterState.stage === "downloading" ||
                updaterState.stage === "installing" ||
                updaterState.stage === "restarting"
              }
              onClick={() => void checkForUpdates({ announceNoUpdate: true })}
            >
              {updaterState.stage === "checking" ? t("about.checking") : t("about.check_updates")}
            </button>
          )}
        </div>
      </div>
    </SettingsSection>
  );
}
