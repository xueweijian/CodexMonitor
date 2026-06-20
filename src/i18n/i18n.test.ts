import { describe, expect, it } from "vitest";
import i18n from "./index";

describe("i18n configuration", () => {
  it("initializes with Chinese (zh) as default language", () => {
    expect(i18n.language).toBe("zh");
  });

  it("translates settings namespace keys correctly in Chinese", () => {
    expect(i18n.t("settings:title")).toBe("设置");
    expect(i18n.t("settings:language")).toBe("语言 / Language");
  });

  it("translates settings namespace keys correctly after switching to English", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.language).toBe("en");
    expect(i18n.t("settings:title")).toBe("Settings");
    expect(i18n.t("settings:language")).toBe("Language");
    
    // Switch back to zh to avoid side effects on other tests
    await i18n.changeLanguage("zh");
  });

  it("handles missing keys gracefully", () => {
    // If a key is missing, i18next by default returns the key itself
    expect(i18n.t("settings:non_existent_key" as any)).toBe("non_existent_key");
  });
});
