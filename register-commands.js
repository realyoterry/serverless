import fetch from 'node-fetch';

const COMMAND = {
  name: 'hello',
  description: 'Replies with a greeting',
  type: 1,
};

fetch(`https://discord.com/api/v10/applications/${process.env.appId}/commands`, {
  method: 'POST',
  headers: {
    'Authorization': `Bot ${process.env.token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(COMMAND),
});
