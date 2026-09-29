const crypto = require('crypto');

/** SYNC: src/lib/read-code.ts */
const READ_CODES_COLLECTION = 'readCodes';
const READ_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const READ_CODE_LENGTH = 8;

function generateReadCode() {
  const bytes = crypto.randomBytes(READ_CODE_LENGTH);
  let out = '';
  for (let i = 0; i < READ_CODE_LENGTH; i++) {
    out += READ_CODE_ALPHABET[bytes[i] % READ_CODE_ALPHABET.length];
  }
  return out;
}

function isAlreadyExists(err) {
  const code = err && err.code;
  return code === 6 || code === 'already-exists' || /ALREADY_EXISTS/i.test(String(err && err.message));
}

/**
 * Reserva un código de 8 caracteres que apunta a mail + token.
 * El token no viaja en el WhatsApp.
 */
async function allocateReadCode(db, mailId, token, existing, FieldValue) {
  const reused = String(existing || '').trim();
  if (reused.length >= READ_CODE_LENGTH) return reused;

  const createdAt = FieldValue && FieldValue.serverTimestamp ? FieldValue.serverTimestamp() : new Date();

  for (let i = 0; i < 8; i++) {
    const code = generateReadCode();
    try {
      await db.collection(READ_CODES_COLLECTION).doc(code).create({
        mailId: String(mailId),
        token: String(token),
        createdAt,
      });
      return code;
    } catch (err) {
      if (isAlreadyExists(err)) continue;
      throw err;
    }
  }
  throw new Error('No se pudo generar un código de lectura');
}

module.exports = {
  READ_CODES_COLLECTION,
  READ_CODE_ALPHABET,
  READ_CODE_LENGTH,
  generateReadCode,
  allocateReadCode,
};
