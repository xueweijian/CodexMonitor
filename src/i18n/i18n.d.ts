import 'i18next';
import { resources, defaultNS } from './index';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: typeof resources['zh']; // use Chinese as base for types
  }
}
