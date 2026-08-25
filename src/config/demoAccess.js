export const demoSignupHostnames = Object.freeze([
  "localhost",
  "127.0.0.1",
  "lightcoral-crab-954053.hostingersite.com",
  "zenshotech.com",
  "www.zenshotech.com",
]);

export function isDemoSignupHostname(hostname) {
  return demoSignupHostnames.includes(String(hostname ?? "").trim().toLowerCase());
}
