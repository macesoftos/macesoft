export const demoPasswordMinimumLength = 8;

export function demoPasswordMeetsMinimum(password) {
  return String(password ?? "").length >= demoPasswordMinimumLength;
}
