// English legal copy (Privacy + Terms), loaded as its own i18n namespace so the
// long text stays out of the main JSON bundle. Bracketed placeholders like
// [REGISTERED ENTITY NAME] are intentional and must be filled once the legal
// entity, tax status, and governing jurisdiction are decided.
import { PRIVACY, TERMS } from "../legal";

export const privacyTitle = "Privacy Policy";
export const termsTitle = "Terms of Service";
export const privacy = PRIVACY;
export const terms = TERMS;
