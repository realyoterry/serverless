import nacl from 'tweetnacl';
import db from '../db.js'; // Adjust path if needed

export const config = {
	api: {
		bodyParser: false,
	},
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
	await new Promise(resolve => {
		req.on('data', chunk => (rawBody += chunk));
		req.on('end', resolve);
	});

	if (
		!verifySignature({
			signature,
			timestamp,
			body: rawBody,
			publicKey: process.env.publicKey,
		})
	) {
		return res.status(401).send('Invalid signature');
	}

	const interaction = JSON.parse(rawBody);

	if (interaction.type === 1) {
		return res.status(200).json({ type: 1 }); // Ping
	}

	// Handle slash commands
	if (interaction.type === 2) {
		const command = interaction.data.name;

		if (command === 'createship') {
			const user1 = interaction.data.options.find(o => o.name === 'user1').value;
			const user2 = interaction.data.options.find(o => o.name === 'user2').value;
			const shipName = interaction.data.options.find(o => o.name === 'shipname').value.trim();

			if (interaction.member.id !== '1094120827601047653') {
				return res.status(403).json({
					type: 4,
					data: { content: 'only the supreme leader, teriyaki can use this command, muahahaha' }
				});
			}

			const [u1, u2] = user1 < user2 ? [user1, user2] : [user2, user1];
			const exists = db.prepare('SELECT * FROM ships WHERE user1_id = ? AND user2_id = ?').get(u1, u2);

			if (exists) {
				db.prepare('UPDATE ships SET ship_name = ? WHERE user1_id = ? AND user2_id = ?').run(shipName, u1, u2);
				return res.status(200).json({
					type: 4,
					data: { content: `✅ Ship name updated: **${shipName}** for <@${u1}> + <@${u2}>.` }
				});
			} else {
				db.prepare('INSERT INTO ships (user1_id, user2_id, ship_name, support_count) VALUES (?, ?, ?, 0)').run(u1, u2, shipName);
				return res.status(200).json({
					type: 4,
					data: { content: `✅ New ship created: **${shipName}** for <@${u1}> + <@${u2}>.` }
				});
			}
		}

		if (command === 'support') {
			const name = interaction.data.options.find(o => o.name === 'shipname').value.trim().toLowerCase();
			const ship = db.prepare('SELECT * FROM ships WHERE LOWER(ship_name) = ?').get(name);

			if (!ship) {
				return res.status(200).json({
					type: 4,
					data: { content: '❌ that ship aint existing!' }
				});
			}

			db.prepare('UPDATE ships SET support_count = support_count + 1 WHERE id = ?').run(ship.id);
			const newCount = ship.support_count + 1;

			return res.status(200).json({
				type: 4,
				data: {
					content: `👍 support added for **${ship.ship_name}** (<@${ship.user1_id}> + <@${ship.user2_id}>). total: ${newCount}`,
				},
			});
		}

		if (command === 'leaderboard') {
			const ships = db.prepare('SELECT * FROM ships ORDER BY support_count DESC LIMIT 10').all();

			if (!ships.length) {
				return res.status(200).json({
					type: 4,
					data: { content: '🚫 no ships found yet hehe' },
				});
			}

			const description = ships.map((s, i) =>
				`**${i + 1}.** **${s.ship_name}** — <@${s.user1_id}> + <@${s.user2_id}> — 💖 **${s.support_count}**`
			).join('\n');

			return res.status(200).json({
				type: 4,
				data: {
					embeds: [
						{
							title: "🏆 ship leaderboard!!!",
							color: 0xFF69B4,
							description,
						},
					],
				},
			});
		}
	}

	return res.status(200).json({
		type: 4,
		data: {
			content: "Unknown command. Try `/createship`, `/support`, or `/leaderboard`.",
		},
	});
}
 