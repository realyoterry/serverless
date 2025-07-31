import { verifyKey } from 'discord-interactions';

const PUBLIC_KEY = process.env.publicKey;

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];

  const rawBody = await new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
  });

  const isValid = verifyKey(rawBody, signature, timestamp, PUBLIC_KEY);

  if (!isValid) {
    return res.status(401).send('Bad request signature');
  }

  const interaction = JSON.parse(rawBody);

  if (interaction.type === 1) {
    return res.json({ type: 1 }); // PING
  }

  if (interaction.type === 2) {
    if (interaction.data.name === 'ping') {
      return res.json({
        type: 4,
        data: { content: 'Pong!' },
      });
    }
  }

  return res.status(400).send('Unhandled interaction type');
}
