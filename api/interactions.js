import { verifySignature } from '../utils/verify.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];

  let rawBody = '';
  await new Promise((resolve) => {
    req.on('data', (chunk) => (rawBody += chunk));
    req.on('end', resolve);
  });

  const isValid = verifySignature({
    signature,
    timestamp,
    body: rawBody,
    publicKey: '736c354e4f88c2744cb4fa75f2928b8d89c28bac9f58eeba6eb94ad3d64b9609',
  });

  if (!isValid) {
    return res.status(401).send('Invalid request signature');
  }

  const interaction = JSON.parse(rawBody);

  if (interaction.type === 1) {
    // Ping from Discord
    return res.status(200).json({ type: 1 });
  }

  if (interaction.type === 2) {
    // Slash command
    return res.status(200).json({
      type: 4,
      data: {
        content: `Hello ${interaction.member.user.username}!`,
      },
    });
  }

  return res.status(400).send('Unhandled interaction type');
}
