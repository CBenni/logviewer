# logviewer
View chat logs of individuals in twitch chat

## Set up
I generally discourage setting this up on your own, as you will not receive any support by me. This is an end-user product meant to run on my server, so this guide is meant for possible collaborators.
1) Install a MySQL server (or write a custom database connector)
2) Copy settings.default.json to settings.json and fill in the gaps
3) run `npm install`
4) run `node index.js`

Optional:
Run TMoohI and use that to proxy your connections for quicker restarts. You will have to modify [settings.json/bot/server](https://github.com/CBenni/logviewer/blob/master/settings.default.json#L16) for this to work.
