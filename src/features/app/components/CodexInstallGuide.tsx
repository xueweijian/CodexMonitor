import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

export function CodexInstallGuide() {
  const [status, setStatus] = useState<"idle" | "installing" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setupListener = async () => {
      try {
        const unlistenFn = await listen<{ downloaded: number; total: number }>(
          "download_progress",
          (event) => {
            if (event.payload.total > 0) {
              setProgress(Math.round((event.payload.downloaded / event.payload.total) * 100));
            }
          }
        );
        unlisten = unlistenFn;
      } catch (e) {
        console.error("Failed to set up listener", e);
      }
    };
    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleAutoInstall = async () => {
    setStatus("installing");
    setProgress(0);
    setErrorMsg("");
    try {
      await invoke("download_codex_cli");
      setStatus("success");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(e.toString());
    }
  };

  const handleManualPath = async () => {
    try {
      const selectedPath = await open({
        directory: false,
        multiple: false,
        title: "选择 Codex CLI 可执行文件",
      });
      if (selectedPath && !Array.isArray(selectedPath)) {
        await invoke("save_codex_path", { path: selectedPath });
        window.location.reload();
      }
    } catch (e: any) {
      console.error("Failed to pick file:", e);
    }
  };

  const handleOpenDocs = () => {
    window.open("https://github.com/your-org/codex#installation", "_blank");
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        width: "100vw",
        backgroundColor: "var(--bg-primary, #1e1e1e)",
        color: "var(--text-primary, #fff)",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9999,
      }}
    >
      <div
        style={{
          padding: "2rem",
          maxWidth: "500px",
          width: "100%",
          backgroundColor: "var(--bg-secondary, #2d2d2d)",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.5rem" }}>需要安装 Codex CLI</h2>
        <p style={{ margin: 0, color: "var(--text-secondary, #ccc)", lineHeight: 1.5 }}>
          Codex CLI 是 CodexMonitor 运行所必需的核心组件。应用未能在您的系统中找到该组件。请选择以下方式进行安装或配置：
        </p>

        {status === "idle" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <button
              onClick={handleAutoInstall}
              style={{
                padding: "1rem",
                fontSize: "1rem",
                cursor: "pointer",
                backgroundColor: "var(--accent-color, #007acc)",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                fontWeight: "bold",
                transition: "background-color 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#005f9e")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-color, #007acc)")}
            >
              🚀 一键自动安装 (推荐)
            </button>
            <button
              onClick={handleManualPath}
              style={{
                padding: "0.8rem",
                fontSize: "0.95rem",
                cursor: "pointer",
                backgroundColor: "transparent",
                color: "var(--text-primary, #fff)",
                border: "1px solid var(--border-color, #444)",
                borderRadius: "4px",
                transition: "background-color 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              📂 手动指定 Codex CLI 路径
            </button>
            <button
              onClick={handleOpenDocs}
              style={{
                padding: "0.8rem",
                fontSize: "0.9rem",
                cursor: "pointer",
                backgroundColor: "transparent",
                color: "var(--text-secondary, #aaa)",
                border: "none",
                textDecoration: "underline",
              }}
            >
              📖 查看安装教程
            </button>
          </div>
        )}

        {status === "installing" && (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div
              style={{
                width: "100%",
                backgroundColor: "var(--bg-tertiary, #444)",
                height: "8px",
                borderRadius: "4px",
                overflow: "hidden",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  backgroundColor: "var(--accent-color, #007acc)",
                  height: "100%",
                  transition: "width 0.3s ease-in-out",
                }}
              />
            </div>
            <p style={{ margin: 0, color: "var(--text-secondary, #ccc)" }}>
              正在下载并安装 Codex CLI... {progress}%
            </p>
          </div>
        )}

        {status === "success" && (
          <div style={{ color: "#4caf50", textAlign: "center", padding: "1rem 0" }}>
            <h3 style={{ margin: "0 0 0.5rem 0" }}>✅ 安装完成！</h3>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary, #ccc)" }}>
              正在为您启动应用程序...
            </p>
          </div>
        )}

        {status === "error" && (
          <div style={{ color: "#f44336" }}>
            <h3 style={{ margin: "0 0 0.5rem 0" }}>❌ 安装失败</h3>
            <pre
              style={{
                fontSize: "0.85rem",
                whiteSpace: "pre-wrap",
                backgroundColor: "rgba(0,0,0,0.3)",
                padding: "0.75rem",
                borderRadius: "4px",
                maxHeight: "150px",
                overflowY: "auto",
                color: "#ffcdd2",
                border: "1px solid #d32f2f",
              }}
            >
              {errorMsg}
            </pre>
            <button
              onClick={() => setStatus("idle")}
              style={{
                marginTop: "1rem",
                padding: "0.75rem 1rem",
                cursor: "pointer",
                backgroundColor: "transparent",
                color: "#fff",
                border: "1px solid #d32f2f",
                borderRadius: "4px",
                width: "100%",
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "rgba(211,47,47,0.1)")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              重试
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
