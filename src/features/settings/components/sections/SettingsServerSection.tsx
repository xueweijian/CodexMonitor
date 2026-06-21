import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import X from "lucide-react/dist/esm/icons/x";
import type {
  AppSettings,
  TailscaleDaemonCommandPreview,
  TailscaleStatus,
  TcpDaemonStatus,
} from "@/types";
import { ModalShell } from "@/features/design-system/components/modal/ModalShell";
import {
  SettingsSection,
  SettingsToggleRow,
  SettingsToggleSwitch,
} from "@/features/design-system/components/settings/SettingsPrimitives";
import { useTranslation, Trans } from "react-i18next";

type AddRemoteBackendDraft = {
  name: string;
  host: string;
  token: string;
};

type SettingsServerSectionProps = {
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  isMobilePlatform: boolean;
  mobileConnectBusy: boolean;
  mobileConnectStatusText: string | null;
  mobileConnectStatusError: boolean;
  remoteBackends: AppSettings["remoteBackends"];
  activeRemoteBackendId: string | null;
  remoteStatusText: string | null;
  remoteStatusError: boolean;
  remoteNameError: string | null;
  remoteHostError: string | null;
  remoteNameDraft: string;
  remoteHostDraft: string;
  remoteTokenDraft: string;
  nextRemoteNameSuggestion: string;
  tailscaleStatus: TailscaleStatus | null;
  tailscaleStatusBusy: boolean;
  tailscaleStatusError: string | null;
  tailscaleCommandPreview: TailscaleDaemonCommandPreview | null;
  tailscaleCommandBusy: boolean;
  tailscaleCommandError: string | null;
  tcpDaemonStatus: TcpDaemonStatus | null;
  tcpDaemonBusyAction: "start" | "stop" | "status" | null;
  onSetRemoteNameDraft: Dispatch<SetStateAction<string>>;
  onSetRemoteHostDraft: Dispatch<SetStateAction<string>>;
  onSetRemoteTokenDraft: Dispatch<SetStateAction<string>>;
  onCommitRemoteName: () => Promise<void>;
  onCommitRemoteHost: () => Promise<void>;
  onCommitRemoteToken: () => Promise<void>;
  onSelectRemoteBackend: (id: string) => Promise<void>;
  onAddRemoteBackend: (draft: AddRemoteBackendDraft) => Promise<void>;
  onMoveRemoteBackend: (id: string, direction: "up" | "down") => Promise<void>;
  onDeleteRemoteBackend: (id: string) => Promise<void>;
  onRefreshTailscaleStatus: () => void;
  onRefreshTailscaleCommandPreview: () => void;
  onUseSuggestedTailscaleHost: () => Promise<void>;
  onTcpDaemonStart: () => Promise<void>;
  onTcpDaemonStop: () => Promise<void>;
  onTcpDaemonStatus: () => Promise<void>;
  onMobileConnectTest: () => void;
};

export function SettingsServerSection({
  appSettings,
  onUpdateAppSettings,
  isMobilePlatform,
  mobileConnectBusy,
  mobileConnectStatusText,
  mobileConnectStatusError,
  remoteBackends,
  activeRemoteBackendId,
  remoteStatusText,
  remoteStatusError,
  remoteNameError,
  remoteHostError,
  remoteNameDraft,
  remoteHostDraft,
  remoteTokenDraft,
  nextRemoteNameSuggestion,
  tailscaleStatus,
  tailscaleStatusBusy,
  tailscaleStatusError,
  tailscaleCommandPreview,
  tailscaleCommandBusy,
  tailscaleCommandError,
  tcpDaemonStatus,
  tcpDaemonBusyAction,
  onSetRemoteNameDraft,
  onSetRemoteHostDraft,
  onSetRemoteTokenDraft,
  onCommitRemoteName,
  onCommitRemoteHost,
  onCommitRemoteToken,
  onSelectRemoteBackend,
  onAddRemoteBackend,
  onMoveRemoteBackend,
  onDeleteRemoteBackend,
  onRefreshTailscaleStatus,
  onRefreshTailscaleCommandPreview,
  onUseSuggestedTailscaleHost,
  onTcpDaemonStart,
  onTcpDaemonStop,
  onTcpDaemonStatus,
  onMobileConnectTest,
}: SettingsServerSectionProps) {
  const { t } = useTranslation("settings");
  const [pendingDeleteRemoteId, setPendingDeleteRemoteId] = useState<string | null>(
    null,
  );
  const [addRemoteOpen, setAddRemoteOpen] = useState(false);
  const [addRemoteBusy, setAddRemoteBusy] = useState(false);
  const [addRemoteError, setAddRemoteError] = useState<string | null>(null);
  const [addRemoteNameDraft, setAddRemoteNameDraft] = useState("");
  const [addRemoteHostDraft, setAddRemoteHostDraft] = useState("");
  const [addRemoteTokenDraft, setAddRemoteTokenDraft] = useState("");
  const isMobileSimplified = isMobilePlatform;
  const pendingDeleteRemote = useMemo(
    () =>
      pendingDeleteRemoteId == null
        ? null
        : remoteBackends.find((entry) => entry.id === pendingDeleteRemoteId) ?? null,
    [pendingDeleteRemoteId, remoteBackends],
  );
  const tcpRunnerStatusText = (() => {
    if (!tcpDaemonStatus) {
      return null;
    }
    if (tcpDaemonStatus.state === "running") {
      const listenAddr = tcpDaemonStatus.listenAddr ?? t("server.configured_listen_address", { defaultValue: "configured listen address" });
      return tcpDaemonStatus.pid
        ? t("server.daemon_running_pid", { pid: tcpDaemonStatus.pid, listenAddr })
        : t("server.daemon_running", { listenAddr });
    }
    if (tcpDaemonStatus.state === "error") {
      return tcpDaemonStatus.lastError ?? t("server.daemon_error");
    }
    return tcpDaemonStatus.listenAddr
      ? t("server.daemon_stopped_addr", { listenAddr: tcpDaemonStatus.listenAddr })
      : t("server.daemon_stopped");
  })();

  const openAddRemoteModal = () => {
    setAddRemoteError(null);
    setAddRemoteNameDraft(nextRemoteNameSuggestion);
    setAddRemoteHostDraft(remoteHostDraft);
    setAddRemoteTokenDraft("");
    setAddRemoteOpen(true);
  };

  const closeAddRemoteModal = () => {
    if (addRemoteBusy) {
      return;
    }
    setAddRemoteOpen(false);
    setAddRemoteError(null);
  };

  const handleAddRemoteConfirm = () => {
    void (async () => {
      if (addRemoteBusy) {
        return;
      }
      setAddRemoteBusy(true);
      setAddRemoteError(null);
      try {
        await onAddRemoteBackend({
          name: addRemoteNameDraft,
          host: addRemoteHostDraft,
          token: addRemoteTokenDraft,
        });
        setAddRemoteOpen(false);
      } catch (error) {
        setAddRemoteError(error instanceof Error ? error.message : t("server.unable_add"));
      } finally {
        setAddRemoteBusy(false);
      }
    })();
  };

  return (
    <SettingsSection
      title={t("server.title")}
      subtitle={
        isMobileSimplified
          ? t("server.sub_mobile")
          : t("server.sub_desktop")
      }
    >

      {!isMobileSimplified && (
        <div className="settings-field">
          <label className="settings-field-label" htmlFor="backend-mode">
            {t("server.mode")}
          </label>
          <select
            id="backend-mode"
            className="settings-select"
            value={appSettings.backendMode}
            onChange={(event) =>
              void onUpdateAppSettings({
                ...appSettings,
                backendMode: event.target.value as AppSettings["backendMode"],
              })
            }
          >
            <option value="local">{t("server.mode_local")}</option>
            <option value="remote">{t("server.mode_remote")}</option>
          </select>
          <div className="settings-help">
            {t("server.mode_sub")}
          </div>
        </div>
      )}

      <>
        {isMobileSimplified && (
          <>
            <div className="settings-field">
              <div className="settings-field-label">{t("server.saved_remotes")}</div>
              <div className="settings-mobile-remotes" role="list" aria-label={t("server.aria_saved")}>
                {remoteBackends.map((entry, index) => {
                  const isActive = entry.id === activeRemoteBackendId;
                  return (
                    <div
                      className={`settings-mobile-remote${isActive ? " is-active" : ""}`}
                      role="listitem"
                      key={entry.id}
                    >
                      <div className="settings-mobile-remote-main">
                        <div className="settings-mobile-remote-name-row">
                          <div className="settings-mobile-remote-name">{entry.name}</div>
                          {isActive && <span className="settings-mobile-remote-badge">{t("server.active")}</span>}
                        </div>
                        <div className="settings-mobile-remote-meta">TCP · {entry.host}</div>
                        <div className="settings-mobile-remote-last">
                          {typeof entry.lastConnectedAtMs === "number"
                            ? t("server.last_connected", { date: new Date(entry.lastConnectedAtMs).toLocaleString() })
                            : t("server.last_connected", { date: t("server.never") })}
                        </div>
                      </div>
                      <div className="settings-mobile-remote-actions">
                        <button
                          type="button"
                          className="ghost settings-mobile-remote-action"
                          onClick={() => {
                            void onSelectRemoteBackend(entry.id);
                          }}
                          disabled={isActive}
                          aria-label={t("server.aria_use", { name: entry.name })}
                        >
                          {isActive ? t("server.btn_using") : t("server.btn_use")}
                        </button>
                        <button
                          type="button"
                          className="ghost settings-mobile-remote-action"
                          onClick={() => {
                            void onMoveRemoteBackend(entry.id, "up");
                          }}
                          disabled={index === 0}
                          aria-label={t("server.aria_move_up", { name: entry.name })}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="ghost settings-mobile-remote-action"
                          onClick={() => {
                            void onMoveRemoteBackend(entry.id, "down");
                          }}
                          disabled={index === remoteBackends.length - 1}
                          aria-label={t("server.aria_move_down", { name: entry.name })}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="ghost settings-mobile-remote-action settings-mobile-remote-action-danger"
                          onClick={() => {
                            setPendingDeleteRemoteId(entry.id);
                          }}
                          aria-label={t("server.aria_delete", { name: entry.name })}
                        >
                          {t("server.btn_delete")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="settings-field-row">
                <button
                  type="button"
                  className="button settings-button-compact"
                  onClick={openAddRemoteModal}
                >
                  {t("server.btn_add")}
                </button>
              </div>
              {remoteStatusText && (
                <div className={`settings-help${remoteStatusError ? " settings-help-error" : ""}`}>
                  {remoteStatusText}
                </div>
              )}
              <div className="settings-help">
                {t("server.switch_remote_help")}
              </div>
            </div>

            <div className="settings-field">
              <label className="settings-field-label" htmlFor="mobile-remote-name">
                {t("server.remote_name")}
              </label>
              <input
                id="mobile-remote-name"
                className="settings-input settings-input--compact"
                value={remoteNameDraft}
                placeholder={t("server.remote_name_placeholder")}
                onChange={(event) => onSetRemoteNameDraft(event.target.value)}
                onBlur={() => {
                  void onCommitRemoteName();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void onCommitRemoteName();
                  }
                }}
              />
              {remoteNameError && <div className="settings-help settings-help-error">{remoteNameError}</div>}
            </div>
          </>
        )}

        {!isMobileSimplified && (
          <SettingsToggleRow
            title={t("server.keep_running")}
            subtitle={t("server.keep_running_sub")}
          >
            <SettingsToggleSwitch
              pressed={appSettings.keepDaemonRunningAfterAppClose}
              onClick={() =>
                void onUpdateAppSettings({
                  ...appSettings,
                  keepDaemonRunningAfterAppClose: !appSettings.keepDaemonRunningAfterAppClose,
                })
              }
            />
          </SettingsToggleRow>
        )}

        <div className="settings-field">
          <div className="settings-field-label">{t("server.remote_backend")}</div>
          <div className="settings-field-row">
            <input
              className="settings-input settings-input--compact"
              value={remoteHostDraft}
              placeholder={t("server.host_placeholder")}
              onChange={(event) => onSetRemoteHostDraft(event.target.value)}
              onBlur={() => {
                void onCommitRemoteHost();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onCommitRemoteHost();
                }
              }}
              aria-label={t("server.aria_host")}
            />
            <input
              type="password"
              className="settings-input settings-input--compact"
              value={remoteTokenDraft}
              placeholder={t("server.token_placeholder")}
              onChange={(event) => onSetRemoteTokenDraft(event.target.value)}
              onBlur={() => {
                void onCommitRemoteToken();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onCommitRemoteToken();
                }
              }}
              aria-label={t("server.aria_token")}
            />
          </div>
          {remoteHostError && <div className="settings-help settings-help-error">{remoteHostError}</div>}
          <div className="settings-help">
            {isMobileSimplified ? (
              <Trans t={t} i18nKey="server.remote_backend_sub">
                Use the Tailscale host from your desktop CodexMonitor app (Server section), for example <code>macbook.your-tailnet.ts.net:4732</code>.
              </Trans>
            ) : (
              t("server.remote_backend_sub2")
            )}
          </div>
        </div>

        {isMobileSimplified && (
          <div className="settings-field">
            <div className="settings-field-label">{t("server.connection_test")}</div>
            <div className="settings-field-row">
              <button
                type="button"
                className="button settings-button-compact"
                onClick={onMobileConnectTest}
                disabled={mobileConnectBusy}
              >
                {mobileConnectBusy ? t("server.busy_connecting") : t("server.btn_connect_test")}
              </button>
            </div>
            {mobileConnectStatusText && (
              <div className={`settings-help${mobileConnectStatusError ? " settings-help-error" : ""}`}>
                {mobileConnectStatusText}
              </div>
            )}
            <div className="settings-help">
              {t("server.connection_test_sub")}
            </div>
          </div>
        )}

        {!isMobileSimplified && (
          <div className="settings-field">
            <div className="settings-field-label">{t("server.mobile_daemon")}</div>
            <div className="settings-field-row">
              <button
                type="button"
                className="button settings-button-compact"
                onClick={() => {
                  void onTcpDaemonStart();
                }}
                disabled={tcpDaemonBusyAction !== null}
              >
                {tcpDaemonBusyAction === "start" ? t("server.busy_starting") : t("server.btn_start")}
              </button>
              <button
                type="button"
                className="button settings-button-compact"
                onClick={() => {
                  void onTcpDaemonStop();
                }}
                disabled={tcpDaemonBusyAction !== null}
              >
                {tcpDaemonBusyAction === "stop" ? t("server.busy_stopping") : t("server.btn_stop")}
              </button>
              <button
                type="button"
                className="button settings-button-compact"
                onClick={() => {
                  void onTcpDaemonStatus();
                }}
                disabled={tcpDaemonBusyAction !== null}
              >
                {tcpDaemonBusyAction === "status" ? t("server.busy_refreshing") : t("server.btn_refresh")}
              </button>
            </div>
            {tcpRunnerStatusText && <div className="settings-help">{tcpRunnerStatusText}</div>}
            {tcpDaemonStatus?.startedAtMs && (
              <div className="settings-help">
                {t("server.started_at", { date: new Date(tcpDaemonStatus.startedAtMs).toLocaleString() })}
              </div>
            )}
            <div className="settings-help">
              <Trans t={t} i18nKey="server.mobile_daemon_sub" values={{ port: "<port>" }}>
                Start this daemon before connecting from iOS. It uses your current token and listens on <code>0.0.0.0:{"<port>"}</code>, matching your configured host port.
              </Trans>
            </div>
          </div>
        )}

        {!isMobileSimplified && (
          <div className="settings-field">
            <div className="settings-field-label">{t("server.tailscale_helper")}</div>
            <div className="settings-field-row">
              <button
                type="button"
                className="button settings-button-compact"
                onClick={onRefreshTailscaleStatus}
                disabled={tailscaleStatusBusy}
              >
                {tailscaleStatusBusy ? t("server.busy_checking") : t("server.btn_detect")}
              </button>
              <button
                type="button"
                className="button settings-button-compact"
                onClick={onRefreshTailscaleCommandPreview}
                disabled={tailscaleCommandBusy}
              >
                {tailscaleCommandBusy ? t("server.busy_refreshing") : t("server.btn_refresh_cmd")}
              </button>
              <button
                type="button"
                className="button settings-button-compact"
                disabled={!tailscaleStatus?.suggestedRemoteHost}
                onClick={() => {
                  void onUseSuggestedTailscaleHost();
                }}
              >
                {t("server.btn_use_suggested")}
              </button>
            </div>
            {tailscaleStatusError && (
              <div className="settings-help settings-help-error">{tailscaleStatusError}</div>
            )}
            {tailscaleStatus && (
              <>
                <div className="settings-help">{tailscaleStatus.message}</div>
                <div className="settings-help">
                  {tailscaleStatus.installed
                    ? t("server.ts_version", { version: tailscaleStatus.version ?? t("about.unknown") })
                    : t("server.ts_install")}
                </div>
                {tailscaleStatus.suggestedRemoteHost && (
                  <div className="settings-help">
                    {t("server.ts_suggested")}<code>{tailscaleStatus.suggestedRemoteHost}</code>
                  </div>
                )}
                {tailscaleStatus.tailnetName && (
                  <div className="settings-help">
                    {t("server.ts_tailnet")}<code>{tailscaleStatus.tailnetName}</code>
                  </div>
                )}
              </>
            )}
            {tailscaleCommandError && (
              <div className="settings-help settings-help-error">{tailscaleCommandError}</div>
            )}
            {tailscaleCommandPreview && (
              <>
                <div className="settings-help">
                  {t("server.manual_cmd")}
                </div>
                <pre className="settings-command-preview">
                  <code>{tailscaleCommandPreview.command}</code>
                </pre>
                {!tailscaleCommandPreview.tokenConfigured && (
                  <div className="settings-help settings-help-error">
                    {t("server.token_empty")}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </>

      <div className="settings-help">
        {isMobileSimplified
          ? t("server.infra_only")
          : t("server.infra_only2")}
      </div>
      {addRemoteOpen && (
        <ModalShell
          className="settings-add-remote-overlay"
          cardClassName="settings-add-remote-card"
          onBackdropClick={closeAddRemoteModal}
          ariaLabel={t("server.modal_add_title")}
        >
          <div className="settings-add-remote-header">
            <div className="settings-add-remote-title">{t("server.modal_add_title")}</div>
            <button
              type="button"
              className="ghost icon-button settings-add-remote-close"
              onClick={closeAddRemoteModal}
              aria-label={t("server.modal_add_close")}
              disabled={addRemoteBusy}
            >
              <X aria-hidden />
            </button>
          </div>
          <div className="settings-field">
            <label className="settings-field-label" htmlFor="settings-add-remote-name">
              {t("server.new_remote_name")}
            </label>
            <input
              id="settings-add-remote-name"
              className="settings-input settings-input--compact"
              value={addRemoteNameDraft}
              onChange={(event) => setAddRemoteNameDraft(event.target.value)}
              disabled={addRemoteBusy}
            />
          </div>
          <div className="settings-field">
            <label className="settings-field-label" htmlFor="settings-add-remote-host">
              {t("server.new_remote_host")}
            </label>
            <input
              id="settings-add-remote-host"
              className="settings-input settings-input--compact"
              value={addRemoteHostDraft}
              placeholder={t("server.new_remote_host_placeholder")}
              onChange={(event) => setAddRemoteHostDraft(event.target.value)}
              disabled={addRemoteBusy}
            />
          </div>
          <div className="settings-field">
            <label className="settings-field-label" htmlFor="settings-add-remote-token">
              {t("server.new_remote_token")}
            </label>
            <input
              id="settings-add-remote-token"
              type="password"
              className="settings-input settings-input--compact"
              value={addRemoteTokenDraft}
              placeholder={t("server.new_remote_token_placeholder")}
              onChange={(event) => setAddRemoteTokenDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddRemoteConfirm();
                }
              }}
              disabled={addRemoteBusy}
            />
          </div>
          {addRemoteError && <div className="settings-help settings-help-error">{addRemoteError}</div>}
          <div className="settings-add-remote-actions">
            <button type="button" className="ghost" onClick={closeAddRemoteModal} disabled={addRemoteBusy}>
              {t("server.btn_cancel")}
            </button>
            <button
              type="button"
              className="button"
              onClick={handleAddRemoteConfirm}
              disabled={addRemoteBusy}
            >
              {addRemoteBusy ? t("server.busy_connecting") : t("server.btn_connect_add")}
            </button>
          </div>
        </ModalShell>
      )}
      {pendingDeleteRemote && (
        <ModalShell
          className="settings-delete-remote-overlay"
          cardClassName="settings-delete-remote-card"
          onBackdropClick={() => setPendingDeleteRemoteId(null)}
          ariaLabel={t("server.modal_del_title")}
        >
          <div className="settings-delete-remote-title">{t("server.modal_del_title")}</div>
          <div className="settings-delete-remote-message">
            <Trans t={t} i18nKey="server.modal_del_msg" values={{ name: pendingDeleteRemote.name }}>
              Remove <strong>{pendingDeleteRemote.name}</strong> from saved remotes? This only
              removes the profile from this device.
            </Trans>
          </div>
          <div className="settings-delete-remote-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => setPendingDeleteRemoteId(null)}
            >
              {t("server.btn_cancel")}
            </button>
            <button
              type="button"
              className="button"
              onClick={() => {
                void onDeleteRemoteBackend(pendingDeleteRemote.id);
                setPendingDeleteRemoteId(null);
              }}
            >
              {t("server.btn_delete_remote")}
            </button>
          </div>
        </ModalShell>
      )}
    </SettingsSection>
  );
}
