import { verifyKey } from 'discord-interactions';

const PUBLIC_KEY = process.env.publicKey;

export const config = {
  api: {
    bodyParser: false,
  },
};

function bufferRequest(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];

  if (!signature || !timestamp) {
    return res.status(401).send('Missing signature or timestamp');
  }

  const rawBody = await bufferRequest(req);
  const isValid = verifyKey(rawBody, signature, timestamp, PUBLIC_KEY);

  if (!isValid) {
    return res.status(401).send('Bad request signature');
  }

  let interaction;
  try {
    interaction = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    return res.status(400).send('Invalid JSON');
  }

  if (interaction.type === 1) {
    // Ping from Discord to verify endpoint
    return res.status(200).json({ type: 1 });
  }

  if (interaction.type === 2 && interaction.data.name === 'ping') {
    // Slash command `/ping`
    return res.status(200).json({
      type: 4,
      data: { content: '🏓 Pong!' },
    });
  }

  return res.status(400).send('Unhandled interaction type');
}
