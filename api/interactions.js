import nacl from 'tweetnacl';

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
	if (percentage <= 60) return "🤝 friends, nothing else!";
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

			res.status(200).json({ type: 5 });

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

				await fetch(`https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bot ${process.env.token}`,
					},
					body: JSON.stringify({
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
					}),
				});
			} catch (error) {
				console.error('Error fetching users:', error);
				await fetch(`https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bot ${process.env.token}`,
					},
					body: JSON.stringify({
						content: '❌ failed to fetch user information nooo.',
					}),
				});
			}
		}

		if (interaction.data.name === 'randomship') {
			res.status(200).json({ type: 5 });

			try {
				const guildId = interaction.guild_id;
				const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, {
					headers: { Authorization: `Bot ${process.env.token}` },
				});
				if (!response.ok) throw new Error('Failed to fetch members');

				const members = await response.json();
				const filtered = members.filter(m => !m.user.bot);

				if (filtered.length < 2) {
					await fetch(`https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bot ${process.env.token}`,
						},
						body: JSON.stringify({
							content: '❌ not enough members to shippp...',
						}),
					});
					return;
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

				await fetch(`https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bot ${process.env.token}`,
					},
					body: JSON.stringify({
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
					}),
				});
			} catch (error) {
				console.error('Error in randomship:', error);
				await fetch(`https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bot ${process.env.token}`,
					},
					body: JSON.stringify({
						content: '❌ couldnt fetch random members.',
					}),
				});
			}
		}

		return res.status(200).json({
			type: 4,
			data: {
				content: "Sorry, I don't recognize that command.",
			},
		});
	}
}