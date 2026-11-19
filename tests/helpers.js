import { createDecipheriv, createHash } from "node:crypto";
import { PDFDocument, degrees } from "../tools/pdflib.js";

/** Create a document; each spec is [width, height, rotation?]. */
export async function makeDoc(specs, { title } = {}) {
  const doc = await PDFDocument.create();
  for (const [w, h, rot = 0] of specs) {
    const page = doc.addPage([w, h]);
    if (rot) page.setRotation(degrees(rot));
  }
  if (title) doc.setTitle(title);
  return doc;
}

/** Save and reload, like the real app does between runs. */
export async function roundTrip(doc) {
  return PDFDocument.load(await doc.save(), { updateMetadata: false });
}

export const approx = (a, b, eps = 0.01) => Math.abs(a - b) < eps;

/**
 * Check an AES-128 (V4) encrypted PDF the way strict readers (Acrobat) do:
 * every string in every top-level object must decrypt with valid padding.
 * Independent of pdf-lib: uses node's own crypto. Returns the decrypted strings.
 */
export function decryptTopLevelStrings(bytes, password) {
  const s = Buffer.from(bytes).toString("latin1");
  // Read /O and /P from the Encrypt dictionary itself: annotations have /P too.
  const encryptObj = s.match(/\/Encrypt (\d+) (\d+) R/).slice(1).join(" ");
  const encStart = s.indexOf(`${encryptObj} obj`);
  const encDict = s.slice(encStart, s.indexOf("endobj", encStart));
  const O = Buffer.from(encDict.match(/\/O <([0-9a-fA-F]+)>/)[1], "hex");
  const id = Buffer.from(s.slice(s.lastIndexOf("/ID")).match(/\/ID \[ <([0-9a-fA-F]+)>/)[1], "hex");
  const P = Buffer.alloc(4);
  P.writeInt32LE(Number(encDict.match(/\/P (-?\d+)/)[1]));
  const PAD = Buffer.from("28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A", "hex");
  const pw = Buffer.concat([Buffer.from(password, "latin1"), PAD]).subarray(0, 32);
  let key = createHash("md5").update(pw).update(O).update(P).update(id).digest();
  for (let i = 0; i < 50; i++) key = createHash("md5").update(key).digest();

  const strings = [];
  for (const m of s.matchAll(/(\d+) (\d+) obj([\s\S]*?)(?:stream\r?\n|endobj)/g)) {
    const [, num, gen, body] = m;
    if (`${num} ${gen}` === encryptObj || /\/Type \/XRef/.test(body)) continue;
    if (/\((?:[^()\\]|\\.)*\)/.test(body)) throw new Error(`object ${num} ${gen} has a plain literal string`);
    const n = Number(num), g = Number(gen);
    const objKey = createHash("md5")
      .update(Buffer.concat([key, Buffer.from([n & 255, (n >> 8) & 255, (n >> 16) & 255, g & 255, g >> 8]), Buffer.from("sAlT")]))
      .digest();
    for (const [, hex] of body.matchAll(/(?<![<>])<([0-9a-fA-F\s]+)>(?!>)/g)) {
      const data = Buffer.from(hex.replace(/\s/g, ""), "hex");
      const decipher = createDecipheriv("aes-128-cbc", objKey, data.subarray(0, 16));
      try {
        strings.push(Buffer.concat([decipher.update(data.subarray(16)), decipher.final()]));
      } catch {
        throw new Error(`object ${num} ${gen} has a string that does not decrypt`);
      }
    }
  }
  return strings;
}
