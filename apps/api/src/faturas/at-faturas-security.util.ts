import { createCipheriv, publicEncrypt, randomBytes, constants } from "node:crypto";

const AES_KEY_BYTES = 16;
const AES_BLOCK = 16;

/** Chave simétrica AES-128 aleatória (128 bits) – spec AT. */
export function gerarChaveSimetricaPedido(): Buffer {
  return randomBytes(AES_KEY_BYTES);
}

/** AES-ECB + PKCS5 padding – spec AT para Password e Created. */
export function cifrarAesEcbPkcs5(plaintext: string, key: Buffer): string {
  const input = Buffer.from(plaintext, "utf8");
  const padLen = AES_BLOCK - (input.length % AES_BLOCK);
  const padding = Buffer.alloc(padLen, padLen);
  const data = Buffer.concat([input, padding]);
  const cipher = createCipheriv("aes-128-ecb", key, null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString("base64");
}

/** Nonce = RSA(publicKey, chaveSimétrica) em Base64 – spec AT. */
export function cifrarChaveSimetricaRsa(key: Buffer, publicKeyPem: string): string {
  const encrypted = publicEncrypt(
    { key: publicKeyPem, padding: constants.RSA_PKCS1_PADDING },
    key,
  );
  return encrypted.toString("base64");
}

export type AtSecurityHeaderFields = {
  username: string;
  passwordEnc: string;
  nonceEnc: string;
  createdEnc: string;
};

/**
 * Constrói campos WS-Security UsernameToken conforme manual AT (WS-Security 2002/12).
 * Password e Created são cifrados com a chave simétrica; Nonce é a chave cifrada com RSA.
 */
export function buildAtSecurityHeaderFields(
  username: string,
  password: string,
  publicKeyPem: string,
  createdAt = new Date(),
): AtSecurityHeaderFields {
  const ks = gerarChaveSimetricaPedido();
  const created = createdAt.toISOString().replace(/\.\d{3}Z$/, "Z");
  return {
    username,
    nonceEnc: cifrarChaveSimetricaRsa(ks, publicKeyPem),
    passwordEnc: cifrarAesEcbPkcs5(password, ks),
    createdEnc: cifrarAesEcbPkcs5(created, ks),
  };
}
