export function getPort(): number {
  return parseInt(process.env.PORT || "3300", 10);
}

export function getHost(): string {
  return process.env.HOST || "0.0.0.0";
}
