// Native Node.js port of the MIT-licensed protocol algorithms in
// https://github.com/tr4cex/TikTok-Encryption (argus.py, ladon.py, lib/Simon.py).
// Copyright (c) 2024 TikTok Encryption Project. See licenses/TikTok-Encryption-MIT.txt.
const { createHash, createCipheriv, randomBytes, randomInt } = require('node:crypto');

const mask = (1n << 64n) - 1n;
const left = (x, bits) => ((x << BigInt(bits)) | (x >> BigInt(64 - bits))) & mask;
const right = (x, bits) => left(x, 64 - bits);
const digest = (algorithm, bytes) => createHash(algorithm).update(bytes).digest();

const T = Array.from({ length: 64 }, (_, index) => (index < 16 ? 0x79cc4519 : 0x7a879d8a));
const rol32 = (x, n) => ((x << n) | (x >>> (32 - n))) >>> 0;

function sm3Js(input) {
  const p0 = (x) => (x ^ rol32(x, 9) ^ rol32(x, 17)) >>> 0;
  const p1 = (x) => (x ^ rol32(x, 15) ^ rol32(x, 23)) >>> 0;
  const bytes = Buffer.from(input);
  const bitLength = bytes.length * 8;
  const withPadding = Buffer.concat([bytes, Buffer.from([0x80])]);
  const zeros = (56 - (withPadding.length % 64) + 64) % 64;
  const message = Buffer.concat([withPadding, Buffer.alloc(zeros), Buffer.alloc(8)]);
  message.writeBigUInt64BE(BigInt(bitLength), message.length - 8);

  let value = [
    0x7380166f, 0x4914b2b9, 0x172442d7, 0xda8a0600, 0xa96f30bc, 0x163138aa, 0xe38dee4d, 0xb0fb0e4e
  ].map((item) => item >>> 0);
  const words = new Array(68).fill(0);
  const expandedWords = new Array(64).fill(0);

  for (let offset = 0; offset < message.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = message.readUInt32BE(offset + index * 4) >>> 0;
    }
    for (let index = 16; index < 68; index += 1) {
      words[index] =
        (p1(words[index - 16] ^ words[index - 9] ^ rol32(words[index - 3], 15)) ^
          rol32(words[index - 13], 7) ^
          words[index - 6]) >>>
        0;
    }
    for (let index = 0; index < 64; index += 1) {
      expandedWords[index] = (words[index] ^ words[index + 4]) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = value;
    for (let index = 0; index < 64; index += 1) {
      const ss1 = rol32((rol32(a, 12) + e + rol32(T[index], index)) >>> 0, 7);
      const ss2 = (ss1 ^ rol32(a, 12)) >>> 0;
      const ff = index < 16 ? (a ^ b ^ c) >>> 0 : ((a & b) | (a & c) | (b & c)) >>> 0;
      const gg = index < 16 ? (e ^ f ^ g) >>> 0 : ((e & f) | (~e & g)) >>> 0;
      const tt1 = (ff + d + ss2 + expandedWords[index]) >>> 0;
      const tt2 = (gg + h + ss1 + words[index]) >>> 0;
      d = c;
      c = rol32(b, 9);
      b = a;
      a = tt1;
      h = g;
      g = rol32(f, 19);
      f = e;
      e = p0(tt2);
    }
    value = [a, b, c, d, e, f, g, h].map((item, index) => (item ^ value[index]) >>> 0);
  }

  const output = Buffer.alloc(32);
  value.forEach((item, index) => output.writeUInt32BE(item, index * 4));
  return output;
}

let sm3Native;

function sm3Digest(bytes) {
  if (sm3Native === undefined) {
    try {
      createHash('sm3').update(Buffer.alloc(0)).digest();
      sm3Native = true;
    } catch {
      sm3Native = false;
    }
  }
  return sm3Native ? digest('sm3', bytes) : sm3Js(bytes);
}

const padded = (bytes) => {
  const count = 16 - (bytes.length % 16);
  return Buffer.concat([bytes, Buffer.alloc(count, count)]);
};
const wordsFromBytes = (bytes) =>
  Array.from({ length: bytes.length / 8 }, (_, index) => bytes.readBigUInt64LE(index * 8));

function packWords(values) {
  const bytes = Buffer.alloc(values.length * 8);
  values.forEach((item, index) => bytes.writeBigUInt64LE(item & mask, index * 8));
  return bytes;
}

function varint(value) {
  let number = Number(value) >>> 0;
  const output = [];
  do {
    const byte = number & 127;
    number >>>= 7;
    output.push(byte | (number ? 128 : 0));
  } while (number);
  return Buffer.from(output);
}

function protobuf(fields) {
  return Buffer.concat(
    Object.entries(fields).map(([tag, value]) => {
      if (typeof value === 'number') {
        return Buffer.concat([varint(Number(tag) * 8), varint(value)]);
      }
      const bytes =
        typeof value === 'string'
          ? Buffer.from(value)
          : Buffer.isBuffer(value)
            ? value
            : protobuf(value);
      return Buffer.concat([varint(Number(tag) * 8 + 2), varint(bytes.length), bytes]);
    })
  );
}

function simon(bytes, key) {
  const roundKeys = [...wordsFromBytes(key)];
  while (roundKeys.length < 72) {
    const index = roundKeys.length;
    const value = right(roundKeys[index - 1], 3) ^ roundKeys[index - 3];
    roundKeys.push(
      (~roundKeys[index - 4] ^
        value ^
        right(value, 1) ^
        ((0x3dc94c3a046d678bn >> BigInt((index - 4) % 62)) & 1n) ^
        3n) &
        mask
    );
  }

  const output = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    let [a, b] = wordsFromBytes(bytes.subarray(offset, offset + 16));
    for (const keyItem of roundKeys) {
      [a, b] = [b, (a ^ (left(b, 1) & left(b, 8)) ^ left(b, 2) ^ keyItem) & mask];
    }
    output.push(packWords([a, b]));
  }
  return Buffer.concat(output);
}

function ladon(seconds, nonce) {
  const [first, ...tail] = wordsFromBytes(
    Buffer.from(digest('md5', Buffer.concat([nonce, Buffer.from('1967')])).toString('hex'))
  );
  const rounds = [first];
  for (let index = 0; index < 33; index += 1) {
    const next = ((right(tail[index], 8) + rounds[index]) & mask) ^ BigInt(index);
    tail.push(next);
    rounds.push(next ^ left(rounds[index], 3));
  }

  const input = padded(Buffer.from(`${seconds}-1611921764-1967`));
  const blocks = [];
  for (let index = 0; index < input.length; index += 16) {
    let [a, b] = wordsFromBytes(input.subarray(index, index + 16));
    for (const key of rounds) {
      b = ((right(b, 8) + a) & mask) ^ key;
      a = left(a, 3) ^ b;
    }
    blocks.push(packWords([a, b]));
  }
  return Buffer.concat([nonce, ...blocks]).toString('base64');
}

function argus(query, body, seconds, randomValue) {
  const params = new URLSearchParams(query);
  const payload = protobuf({
    1: 0x20200929 * 2,
    2: 2,
    3: randomValue,
    4: '1967',
    5: params.get('device_id') || '',
    6: '1611921764',
    7: params.get('version_name') || '',
    8: 'v04.04.05-ov-android',
    9: 134744640,
    10: Buffer.alloc(8),
    11: 0,
    12: seconds * 2,
    13: sm3Digest(body.length ? digest('md5', body) : Buffer.alloc(16)).subarray(0, 6),
    14: sm3Digest(query ? Buffer.from(query) : Buffer.alloc(16)).subarray(0, 6),
    15: { 1: 1, 2: 1, 3: 1, 7: 3348294860 },
    16: '',
    20: 'none',
    21: 738,
    23: { 1: 'NX551J', 2: 8196, 4: 2162219008 },
    25: 2
  });
  const signKey = Buffer.from(
    'ac1adaae95a7af94a5114ab3b3a97dd80050aa0a39314c40528caec95256c28c',
    'hex'
  );
  const key = sm3Digest(Buffer.concat([signKey, Buffer.from('f281616f', 'hex'), signKey]));
  const scrambled = Buffer.concat([
    Buffer.from('f2f7fcfff2f7fcff', 'hex'),
    simon(padded(payload), key)
  ]);
  for (let index = 8; index < scrambled.length; index += 1) {
    scrambled[index] ^= scrambled[index % 8];
  }
  scrambled.reverse();

  const input = Buffer.concat([
    Buffer.from('a66ead9f7701d00c18', 'hex'),
    scrambled,
    Buffer.from('ao')
  ]);
  const cipher = createCipheriv(
    'aes-128-cbc',
    digest('md5', signKey.subarray(0, 16)),
    digest('md5', signKey.subarray(16))
  );
  return Buffer.concat([Buffer.from('f281', 'hex'), cipher.update(input), cipher.final()]).toString(
    'base64'
  );
}

function signRequest(
  url,
  body = '',
  { now = Date.now(), nonce = randomBytes(4), randomValue = randomInt(0x7fffffff) } = {}
) {
  const bytes = Buffer.from(body);
  const seconds = Math.floor(now / 1000);
  return {
    'x-argus': argus(new URL(url).search.slice(1), bytes, seconds, randomValue),
    'x-ladon': ladon(seconds, nonce),
    'x-khronos': String(seconds),
    'x-ss-req-ticket': String(now),
    ...(bytes.length ? { 'X-SS-STUB': digest('md5', bytes).toString('hex') } : {})
  };
}

module.exports = {
  signRequest
};
