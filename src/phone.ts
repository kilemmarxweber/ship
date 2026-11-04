import { countries, defaultCountry, digitsOnly } from "@/src/countries";

export function splitPhone(phone: string) {
  const digits = digitsOnly(phone);
  const match = [...countries]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((item) => digits.startsWith(item.dial));
  if (match) {
    return { country: match, national: digits.slice(match.dial.length) };
  }
  return { country: defaultCountry, national: digits };
}

export function composePhone(dial: string, national: string) {
  return `+${digitsOnly(dial)}${digitsOnly(national)}`;
}

export function isValidContactPhone(phone: string) {
  const digits = digitsOnly(phone.startsWith("+") ? phone.slice(1) : phone);
  return digits.length >= 10 && digits.length <= 15;
}
