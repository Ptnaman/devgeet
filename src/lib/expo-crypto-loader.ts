export type ExpoCryptoModuleLike = {
  CryptoDigestAlgorithm: {
    SHA256: string;
  };
  digestStringAsync: (algorithm: string, data: string) => Promise<string>;
  getRandomBytes: (byteCount: number) => Uint8Array;
};

let cachedModule: ExpoCryptoModuleLike | null | undefined;

export const loadExpoCryptoModule = () => {
  if (cachedModule !== undefined) {
    return cachedModule;
  }

  try {
    // The native module is loaded lazily so unsupported platforms fail gracefully.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require("expo-crypto") as ExpoCryptoModuleLike;
    return cachedModule;
  } catch {
    cachedModule = null;
    return cachedModule;
  }
};
