import nacl from 'tweetnacl';

export function verifySignature({ signature, timestamp, body, publicKey }) {
  const isVerified = nacl.sign.detached.verify(
    Buffer.from(timestamp + body),
    Buffer.from(signature, 'hex'),
    Buffer.from(publicKey, 'hex')
  );
  return isVerified;
}
