const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  READ_CODE_ALPHABET,
  READ_CODE_LENGTH,
  generateReadCode,
  allocateReadCode,
} = require('./read-code');

test('el código tiene 8 caracteres sin 0, O, 1, I ni l', () => {
  const code = generateReadCode();
  assert.equal(code.length, READ_CODE_LENGTH);
  assert.match(code, new RegExp(`^[${READ_CODE_ALPHABET}]+$`));
  assert.doesNotMatch(code, /[01IOl]/);
});

test('si ya hay código, no genera otro', async () => {
  const code = await allocateReadCode({}, 'mail-1', 'tok', 'x7Km9pQ2');
  assert.equal(code, 'x7Km9pQ2');
});

test('reserva el documento y reintenta si el código ya existe', async () => {
  let creates = 0;
  const db = {
    collection() {
      return {
        doc() {
          return {
            async create() {
              creates += 1;
              if (creates === 1) {
                const err = new Error('ALREADY_EXISTS');
                err.code = 6;
                throw err;
              }
            },
          };
        },
      };
    },
  };
  const code = await allocateReadCode(db, 'mail-1', 'tok', null, null);
  assert.equal(code.length, 8);
  assert.equal(creates, 2);
});
