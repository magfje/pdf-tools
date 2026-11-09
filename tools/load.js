import { PDFDocument } from "./pdflib.js";

export class PasswordRequiredError extends Error {
  constructor(name, wrongPassword) {
    super(
      wrongPassword
        ? `wrong password for "${name}"`
        : `"${name}" is password-protected`
    );
    this.name = "PasswordRequiredError";
    this.fileName = name;
    this.wrongPassword = wrongPassword;
  }
}

/**
 * Load a PDF. Encrypted files are decrypted with `password`; files that only
 * have an owner password (editing restrictions) open with no password at all.
 * `updateMetadata: false` keeps the original producer/dates instead of
 * stamping "pdf-lib" on everything.
 */
export async function loadPdf(bytes, { name = "file", password } = {}) {
  const options = { updateMetadata: false };
  try {
    return await PDFDocument.load(bytes, options);
  } catch (error) {
    if (error?.name !== "EncryptedPDFError" && !/encrypted/i.test(error?.message)) {
      throw new Error(`could not read "${name}": ${error.message}`);
    }
  }

  // Encrypted: try the given password, or an empty user password.
  try {
    return await PDFDocument.load(bytes, { ...options, password: password ?? "" });
  } catch (error) {
    if (/password/i.test(error?.message)) {
      throw new PasswordRequiredError(name, password !== undefined);
    }
    throw new Error(`could not read "${name}": ${error.message}`);
  }
}
