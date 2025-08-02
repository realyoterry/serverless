import nacl from 'tweetnacl';
import mongoose from 'mongoose';

export const config = {
	api: { bodyParser: false },
};

const shipSchema = new mongoose.Schema({
	user1: String,
	user2: String,
	name: { type: String, unique: true },
	support: { type: Number, default: 0 },
});

const Ship = mongoose.models.Ship || mongoose.model('Ship', shipSchema);

const connectDB = async () => {
	if (mongoose.connection.readyState === 0) {
		console.log(process.env.mongoUri);
		await mongoose.connect(process.env.mongoUri, { dbName: 'mybotdb' });
		console.log('✅ MongoDB connected');
	}
};

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

	// For application commands (type 2), DEFER immediately (within 3 seconds)
	if (interaction.type === 2) {
		// Send defer right away, synchronously
		res.status(200).json({ type: 5 });

		// Now run async logic below without blocking the defer response
		const followupUrl = `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;

		const doPatch = async (data) => {
			try {
				console.log('PATCHing interaction with data:', data);
				const res = await fetch(followupUrl, {
					method: 'PATCH',
					headers: {
						Authorization: `Bot ${process.env.token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(data),
				});
				console.log('PATCH response status:', res.status);
				if (!res.ok) {
					const text = await res.text();
					console.error('PATCH failed:', text);
				}
			} catch (err) {
				console.error('Failed to PATCH interaction followup:', err);
			}
		};

		try {
			await connectDB();
		} catch (err) {
			console.error('MongoDB connection error:', err);
			await doPatch({ content: '❌ Database connection error, try again later.' });
			return;
		}

		const { name: command } = interaction.data;

		if (command === 'ship' || command === 'randomship') {
			const getUser = async (id) => {
				const res = await fetch(`https://discord.com/api/v10/users/${id}`, {
					headers: { Authorization: `Bot ${process.env.token}` },
				});
				return await res.json();
			};

			let user1, user2;

			if (command === 'ship') {
				user1 = interaction.data.options.find(opt => opt.name === 'user1')?.value;
				user2 = interaction.data.options.find(opt => opt.name === 'user2')?.value;
			} else {
				const guildId = interaction.guild_id;
				try {
					const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, {
						headers: { Authorization: `Bot ${process.env.token}` },
					});
					const members = (await res.json()).filter(m => !m.user.bot);
					const picks = [];
					while (picks.length < 2) {
						const m = members[Math.floor(Math.random() * members.length)];
						if (!picks.find(p => p.user.id === m.user.id)) picks.push(m);
					}
					[user1, user2] = picks.map(m => m.user.id);
				} catch (err) {
					console.error('Failed to fetch guild members:', err);
					await doPatch({ content: '❌ Failed to fetch guild members.' });
					return;
				}
			}

			try {
				const [u1, u2] = await Promise.all([getUser(user1), getUser(user2)]);
				const percentage = user1 === user2 ? 100 : Math.floor(Math.random() * 101);
				const name1 = u1.global_name || u1.username;
				const name2 = u2.global_name || u2.username;
				const shipName = name1.slice(0, name1.length / 2) + name2.slice(name2.length / 2);

				console.log('About to PATCH with data:', data);
				await doPatch({
					embeds: [{
						title: command === 'ship' ? '💞 ship resulttt 💞' : '🎲 random shippp 🎲',
						color: 0xFF69B4,
						fields: [
							{ name: 'cute couple', value: `<@${u1.id}> + <@${u2.id}>` },
							{ name: 'compatibility', value: `${percentage}%`, inline: true },
							{ name: 'ship name', value: shipName, inline: true },
							{ name: 'comment', value: getComment(percentage) },
						]
					}]
				});
			} catch (err) {
				console.error('Error in ship command:', err);
				await doPatch({ content: '❌ Failed to fetch user data for ship.' });
			}

			return;
		}

		if (command === 'editship') {
			if (interaction.member.user.id !== '1094120827601047653') {
				await doPatch({ content: "only our supreme leader, teriyaki, can use this muahahaha." });
				return;
			}

			const opts = Object.fromEntries(interaction.data.options.map(opt => [opt.name, opt.value]));

			try {
				if (opts.action === 'add') {
					await Ship.create({ user1: opts.user1, user2: opts.user2, name: opts.name });
					await doPatch({ content: `✅ ship "${opts.name}" created! yayyy` });
					return;
				}
				if (opts.action === 'edit') {
					const result = await Ship.updateOne(
						{ user1: opts.user1, user2: opts.user2 },
						{ name: opts.name }
					);
					if (result.modifiedCount === 0) throw new Error("No ship found with those users.");
					await doPatch({ content: `✏️ ship name updated to "${opts.name}"!` });
					return;
				}
				if (opts.action === 'remove') {
					const result = await Ship.deleteOne({ name: opts.name });
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

		if (command === 'edit_ship_count') {
			if (interaction.member.user.id !== '1094120827601047653') {
				await doPatch({ content: "only our supreme leader, teriyaki, can use this muahahaha." });
				return;
			}

			const name = interaction.data.options.find(opt => opt.name === 'name').value;
			const support = interaction.data.options.find(opt => opt.name === 'support').value;

			try {
				const updated = await Ship.updateOne({ name }, { support });
				if (updated.modifiedCount === 0) throw new Error("ship not found :(");
				await doPatch({ content: `✅ ship "${name}" support count updated to ${support}!` });
			} catch (err) {
				console.error('edit_ship_count error:', err);
				await doPatch({ content: `❌ ${err.message}` });
			}

			return;
		}

		if (command === 'support') {
			const name = interaction.data.options.find(opt => opt.name === 'name').value;

			try {
				const ship = await Ship.findOne({ name });
				if (!ship) throw new Error("ship not found :(");
				ship.support += 1;
				await ship.save();

				await doPatch({
					content: `✅ you supported "${name}" hehhee! its now at ${ship.support}`
				});
			} catch (err) {
				console.error('support error:', err);
				await doPatch({ content: `❌ ${err.message}` });
			}

			return;
		}

		if (command === 'leaderboard') {
			try {
				const ships = await Ship.find().sort({ support: -1 }).limit(10);
				if (ships.length === 0) {
					await doPatch({ content: '❌ no ships found noo.' });
					return;
				}

				const description = ships.map((s, i) => (
					`**${i + 1}.** **${s.name}** — <@${s.user1}> + <@${s.user2}> — **${s.support}** supports`
				)).join('\n');

				await doPatch({
					embeds: [{
						title: '📈 ship leaderboarddd',
						color: 0xff69b4,
						description,
					}]
				});
			} catch (err) {
				console.error('leaderboard error:', err);
				await doPatch({ content: `❌ ${err.message}` });
			}

			return;
		}

		// fallback unknown command
		await doPatch({ content: "sorry, I don't recognize that command." });
	}
}
