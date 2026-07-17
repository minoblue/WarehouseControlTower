const env = import.meta.env as unknown as Record<string, unknown>;

export const readEnv = (name: string, fallback: string): string => {
  const value = env[name];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
};
