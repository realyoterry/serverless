const applicationId = process.env.appId;
const botToken = process.env.token;

const commands = [
    {
        name: 'ping',
        description: 'Replies with Pong!',
    }
];

fetch(`https://discord.com/api/v10/applications/${applicationId}/commands`, {
    method: 'PUT',
    headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
})
    .then(res => res.json())
    .then(console.log)
    .catch(console.error);
