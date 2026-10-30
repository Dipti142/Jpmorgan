export function maskSensitiveData(obj: any, visited = new WeakSet()): any {
  if (obj === null || typeof obj !== "object") return obj;

  if (visited.has(obj)) return "[Circular]";
  visited.add(obj);

  if (Array.isArray(obj)) {
    return obj.map(item => maskSensitiveData(item, visited));
  }

  const masked: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key.toLowerCase().includes("password")) {
      masked[key] = "********";
    } else {
      masked[key] = maskSensitiveData(value, visited);
    }
  }

  return masked;
}