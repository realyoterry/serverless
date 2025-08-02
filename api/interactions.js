import nacl from 'tweetnacl';
import { MongoClient } from 'mongodb';

export const config = {
	api: { bodyParser: false },
};

// MongoDB URI from env
const uri = process.env.mongoUri;

// Create MongoClient with options
const client = new MongoClient(uri, {
  serverApi: {
    version: '1',
    strict: true,
    deprecationErrors: true,
  }
});

let db; // will hold the connected DB instance

const connectDB = async () => {
  if (!db) {
    try {
      await client.connect();
      // Use your database name here (make sure it matches your cluster)
      db = client.db('mybotdb');
      console.log('✅ MongoDB connected');
      // Ping the DB to confirm connection
      await db.command({ ping: 1 });
      console.log('Ping successful');
    } catch (err) {
      console.error('MongoDB connection error:', err);
      throw err;
    }
  }
};

// Example ship collection access helper
const shipsCollection = () => db.collection('ships');

// Simplified ship schema logic replaced by direct collection ops below

function verifySignature({ signature, timestamp, body, publicKey }) {
  return nacl.sign.detached.verify(
    Buffer.from(timestamp + body),
    Buffer.from(signature, 'hex'),
    Buffer.from(publicKey, 'hex')
  );
}

function getComment(percentage) {
  if (percentage <= 20) return "👋 time to say goodbye...";
  if (percentage <= 40) return "😬 just stay friends bro!";
  if (percentage <= 60) return "🤝 bff, nothing else!";
  if (percentage <= 80) return "✨ yall got a chance!";
  return "perfect soulmates! go to the motel tonight or i will find u.";
}

export default async function handler(req, res) {
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];
  let rawBody = '';

  await new Promise((resolve) => {
    req.on('data', (chunk) => (rawBody += chunk));
    req.on('end', resolve);
  });

  if (!verifySignature({ signature, timestamp, body: rawBody, publicKey: process.env.publicKey })) {
    return res.status(401).send('Invalid request signature');
  }

  const interaction = JSON.parse(rawBody);

  // Respond to PINGs immediately
  if (interaction.type === 1) return res.status(200).json({ type: 1 });

  if (interaction.type === 2) {
    res.status(200).json({ type: 5 }); // defer

    const followupUrl = `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;

    const doPatch = async (data) => {
      try {
        const patchRes = await fetch(followupUrl, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
        if (!patchRes.ok) {
          const text = await patchRes.text();
          console.error('PATCH failed:', text);
        }
      } catch (err) {
        console.error('Failed to PATCH interaction followup:', err);
      }
    };

    try {
      await connectDB();
    } catch (err) {
      await doPatch({ content: '❌ Database connection error, try again later.' });
      return;
    }

    const { name: command } = interaction.data;

    if (command === 'editship') {
      if (interaction.member.user.id !== '1094120827601047653') {
        await doPatch({ content: "only our supreme leader, teriyaki, can use this muahahaha." });
        return;
      }

      const opts = Object.fromEntries(interaction.data.options.map(opt => [opt.name, opt.value]));

      try {
        if (opts.action === 'add') {
          await shipsCollection().insertOne({ user1: opts.user1, user2: opts.user2, name: opts.name, support: 0 });
          await doPatch({ content: `✅ ship "${opts.name}" created! yayyy` });
          return;
        }
        if (opts.action === 'edit') {
          const result = await shipsCollection().updateOne(
            { user1: opts.user1, user2: opts.user2 },
            { $set: { name: opts.name } }
          );
          if (result.modifiedCount === 0) throw new Error("No ship found with those users.");
          await doPatch({ content: `✏️ ship name updated to "${opts.name}"!` });
          return;
        }
        if (opts.action === 'remove') {
          const result = await shipsCollection().deleteOne({ name: opts.name });
          if (result.deletedCount === 0) throw new Error(`Ship "${opts.name}" not found.`);
          await doPatch({ content: `🗑️ ship "${opts.name}" deleted!` });
          return;
        }
        await doPatch({ content: `❌ unknown action "${opts.action}"` });
      } catch (err) {
        console.error('editship error:', err);
        await doPatch({ content: `❌ ${err.message}` });
      }

      return;
    }

    // You can similarly rewrite other commands like support, edit_ship_count, leaderboard etc using
    // direct collection calls like findOne(), updateOne(), find(), etc.

    // For example, 'support':
    if (command === 'support') {
      const name = interaction.data.options.find(opt => opt.name === 'name').value;

      try {
        const ship = await shipsCollection().findOne({ name });
        if (!ship) throw new Error("ship not found :(");
        await shipsCollection().updateOne({ name }, { $inc: { support: 1 } });
        await doPatch({
          content: `✅ you supported "${name}" hehhee! its now at ${ship.support + 1}`
        });
      } catch (err) {
        console.error('support error:', err);
        await doPatch({ content: `❌ ${err.message}` });
      }

      return;
    }

    // Add your other commands here with similar adjustments...

    await doPatch({ content: "sorry, I don't recognize that command." });
  }
}
