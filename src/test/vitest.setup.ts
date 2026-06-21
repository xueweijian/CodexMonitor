import { vi } from "vitest";

if (!("IS_REACT_ACT_ENVIRONMENT" in globalThis)) {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    value: true,
    writable: true,
  });
} else {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
}

if (!("matchMedia" in globalThis)) {
  Object.defineProperty(globalThis, "matchMedia", {
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }),
  });
}

if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverMock });
}

if (!("IntersectionObserver" in globalThis)) {
  class IntersectionObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  Object.defineProperty(globalThis, "IntersectionObserver", {
    value: IntersectionObserverMock,
  });
}

if (!("requestAnimationFrame" in globalThis)) {
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    value: (callback: FrameRequestCallback) =>
      setTimeout(() => callback(Date.now()), 0),
  });
  Object.defineProperty(globalThis, "cancelAnimationFrame", {
    value: (id: number) => clearTimeout(id),
  });
}

const hasLocalStorage = "localStorage" in globalThis;
const existingLocalStorage = hasLocalStorage
  ? (globalThis as { localStorage?: Storage }).localStorage
  : null;

if (!existingLocalStorage || typeof existingLocalStorage.clear !== "function") {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key) ?? null : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorage,
    writable: true,
    configurable: true,
  });
}

import enSettings from "../i18n/locales/en/settings.json";
import enCommon from "../i18n/locales/en/common.json";

vi.mock("react-i18next", () => {
  const getTranslation = (key: string, ns?: string) => {
    let dict: any = ns === "common" ? enCommon : enSettings;
    let cleanKey = key;
    if (key.includes(":")) {
      const [namespace, realKey] = key.split(":");
      dict = namespace === "common" ? enCommon : enSettings;
      cleanKey = realKey;
    }
    let current = dict;
    for (const part of cleanKey.split(".")) {
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        return key;
      }
    }
    return typeof current === "string" ? current : key;
  };

  return {
    useTranslation: (ns?: string) => ({
      t: (key: string) => getTranslation(key, ns),
      i18n: {
        changeLanguage: vi.fn().mockResolvedValue(undefined),
        language: "en",
      },
    }),
    initReactI18next: {
      type: "3rdParty",
      init: () => {},
    },
    I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

