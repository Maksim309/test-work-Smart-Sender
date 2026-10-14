export function getFingerprint(
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): string {
  const savedFingerprint = storage.getItem("webhook.fingerprint");

  if (savedFingerprint && /^[a-f0-9]{32}$/.test(savedFingerprint)) {
    return savedFingerprint;
  }

  const fingerprint = Array.from(
    crypto.getRandomValues(new Uint8Array(16)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");

  storage.setItem("webhook.fingerprint", fingerprint);

  return fingerprint;
}
