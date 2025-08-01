import nacl from 'tweetnacl';

export const config = {
	api: {
		bodyParser: false,
	},
};

import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Init database
const dbDir = '/tmp';
if (!existsSync(dbDir)) mkdirSync(dbDir);
const db = new Database(join(dbDir, 'ships.db'));

// Create the table once (won't run if it already exists)
db.exec(`
  CREATE TABLE IF NOT EXISTS ships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1 TEXT NOT NULL,
    user2 TEXT NOT NULL,
    name TEXT UNIQUE NOT NULL,
    supportCount INTEGER DEFAULT 0
  );
`);


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

	const isValid = verifySignature({
		signature,
		timestamp,
		body: rawBody,
		publicKey: process.env.publicKey,
	});

	if (!isValid) {
		return res.status(401).send('Invalid request signature');
	}

	const interaction = JSON.parse(rawBody);

	if (interaction.type === 1) {
		return res.status(200).json({ type: 1 });
	}

	if (interaction.type === 2) {
		if (interaction.data.name === 'ship') {
			const user1 = interaction.data.options.find(opt => opt.name === 'user1').value;
			const user2 = interaction.data.options.find(opt => opt.name === 'user2').value;

			async function fetchUser(userId) {
				const res = await fetch(`https://discord.com/api/v10/users/${userId}`, {
					headers: { Authorization: `Bot ${process.env.token}` },
				});
				if (!res.ok) throw new Error('Failed to fetch user');
				return res.json();
			}

			try {
				const [member1, member2] = await Promise.all([fetchUser(user1), fetchUser(user2)]);

				let percentage = Math.floor(Math.random() * 101);

				if (user1 === user2) percentage = 100;

				const half1 = member1.username.slice(0, Math.floor(member1.username.length / 2));
				const half2 = member2.username.slice(Math.floor(member2.username.length / 2));
				const shipName = half1 + half2;

				return res.status(200).json({
					type: 4,
					data: {
						embeds: [
							{
								title: "💞 ship resulttt 💞",
								color: 0xFF69B4,
								fields: [
									{ name: "cute couple", value: `<@${member1.id}> + <@${member2.id}>` },
									{ name: "compatitability", value: `${percentage}%`, inline: true },
									{ name: "ship name", value: shipName, inline: true },
									{ name: "comment", value: getComment(percentage) },
								],
							},
						],
					},
				});
			} catch (error) {
				return res.status(200).json({
					type: 4,
					data: { content: '❌ failed to fetch user information noo.' },
				});
			}
		}

		if (interaction.data.name === 'randomship') {
			try {
				const guildId = interaction.guild_id;
				const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, {
					headers: { Authorization: `Bot ${process.env.token}` },
				});
				if (!response.ok) throw new Error('Failed to fetch members');

				const members = await response.json();
				const filtered = members.filter(m => !m.user.bot);

				if (filtered.length < 2) {
					return res.status(200).json({
						type: 4,
						data: { content: 'not enough members to shippp!' },
					});
				}

				let random = [];

				while (random.length < 2) {
					const pick = filtered[Math.floor(Math.random() * filtered.length)];
					if (!random.find(m => m.user.id === pick.user.id)) random.push(pick);
				}

				const [user1, user2] = random.map(m => m.user);
				const percentage = Math.floor(Math.random() * 101);
				const half1 = user1.username.slice(0, Math.floor(user1.username.length / 2));
				const half2 = user2.username.slice(Math.floor(user2.username.length / 2));
				const shipName = half1 + half2;

				return res.status(200).json({
					type: 4,
					data: {
						embeds: [
							{
								title: "🎲 random shippp 🎲",
								color: 0x9370DB,
								fields: [
									{ name: "cute couple", value: `<@${user1.id}> + <@${user2.id}>` },
									{ name: "compatibility", value: `${percentage}%`, inline: true },
									{ name: "ship name", value: shipName, inline: true },
									{ name: "comment", value: getComment(percentage) }
								]
							}
						]
					}
				});
			} catch (error) {
				return res.status(200).json({
					type: 4,
					data: { content: '❌ could not fetch random members noo.' },
				});
			}
		}

		if (interaction.data.name === 'createship') {
			if (interaction.user.id !== '1094120827601047653') {
				return res.status(200).json({ type: 4, data: { content: "only our surpreme leader, teriyaki can use this muahahaha." } });
			}

			const user1 = interaction.data.options.find(opt => opt.name === 'user1').value;
			const user2 = interaction.data.options.find(opt => opt.name === 'user2').value;
			const name = interaction.data.options.find(opt => opt.name === 'name').value;

			try {
				const stmt = db.prepare('INSERT INTO ships (user1, user2, name) VALUES (?, ?, ?)');
				stmt.run(user1, user2, name);

				return res.status(200).json({ type: 4, data: { content: `✅ ship "${name}" created!! yayyy` } });
			} catch (err) {
				return res.status(200).json({ type: 4, data: { content: `❌ ${err.message}` } });
			}
		}

		if (interaction.data.name === 'support') {
			const name = interaction.data.options.find(opt => opt.name === 'name').value;

			try {
				const ship = db.prepare('SELECT * FROM ships WHERE name = ?').get(name);
				if (!ship) throw new Error("ship not found :(");

				db.prepare('UPDATE ships SET supportCount = supportCount + 1 WHERE name = ?').run(name);

				return res.status(200).json({
					type: 4,
					data: { content: `✅ you supported ${name} hehhee! its now at ${ship.supportCount + 1}` },
				});
			} catch (err) {
				return res.status(200).json({ type: 4, data: { content: `❌ ${err.message}` } });
			}
		}

		if (interaction.data.name === 'leaderboard') {
			try {
				const rows = db.prepare('SELECT * FROM ships ORDER BY supportCount DESC LIMIT 10').all();

				if (rows.length === 0) {
					return res.status(200).json({ type: 4, data: { content: '❌ no ships found noo.' } });
				}

				let description = '';
				rows.forEach((ship, i) => {
					description += `**${i + 1}.** **${ship.ship_name}** — <@${ship.user1_id}> + <@${ship.user2_id}> — **${ship.support_count}** supports\n`;
				});

				return res.status(200).json({
					type: 4,
					data: {
						embeds: [{
							title: '📈 ship leaderboarddd',
							color: 0xff69b4,
							description
						}]
					}
				});
			} catch (err) {
				return res.status(200).json({ type: 4, data: { content: `❌ ${err.message}` } });
			}
		}

		return res.status(200).json({
			type: 4,
			data: {
				content: "sorry, I don't recognize that command.",
			},
		});
	}
}
