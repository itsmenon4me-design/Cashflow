import { enText } from "./en";
import { idText } from "./id";

export const locales = {
  id: idText,
  en: enText,
} as const;

export const uiText = locales.id;
