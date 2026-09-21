export function titleFromDir(dir: string): string {
  return dir
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function titleFromName(name: string): string {
  if (/[A-Z]/.test(name) || /\s/.test(name)) return name.trim();
  return name
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => (word[0] ?? "").toUpperCase() + word.slice(1))
    .join(" ");
}

export function titleCase(value: string): string {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}