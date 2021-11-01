const needle = require('needle');
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
//const io = new Server(server);

// server-side
const io = require("socket.io")(server, {
    cors: {
      methods: ["GET", "POST"],
    }
  });

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
})

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('newRule', (rule) => {
        console.log("got rule" +rule);
        setRules(rule);
    })
});

const token = "AAAAAAAAAAAAAAAAAAAAAG5VVQEAAAAATXVIxiA19xSIYMtrzdq9sWW1YKE%3DBlPj2vJwoa97lw66BNGQnxZhPt8lZ2ep8s1JVqVVCfZFnwKceM";

const rulesURL = 'https://api.twitter.com/2/tweets/search/stream/rules';
const streamURL = 'https://api.twitter.com/2/tweets/search/stream';

const rules = [{
        'value': 'start the stream'
    }
];


//Retrieved from https://github.com/twitterdev/Twitter-API-v2-sample-code/blob/b3e13798ae1093251f6b03830e4c30b5002e3c46/Filtered-Stream/filtered_stream.js#L145
async function getAllRules() {

    const response = await needle('get', rulesURL, {
        headers: {
            "authorization": `Bearer ${token}`
        }
    })

    if (response.statusCode !== 200) {
        console.log("Error:", response.statusMessage, response.statusCode)
        throw new Error(response.body);
    }

    return (response.body);
}


//Retrieved from https://github.com/twitterdev/Twitter-API-v2-sample-code/blob/b3e13798ae1093251f6b03830e4c30b5002e3c46/Filtered-Stream/filtered_stream.js#L145
async function deleteAllRules(rules) {

    if (!Array.isArray(rules.data)) {
        return null;
    }

    const ids = rules.data.map(rule => rule.id);

    const data = {
        "delete": {
            "ids": ids
        }
    }

    const response = await needle('post', rulesURL, data, {
        headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${token}`
        }
    })

    if (response.statusCode !== 200) {
        throw new Error(response.body);
    }

    return (response.body);

}

//Retrieved from https://github.com/twitterdev/Twitter-API-v2-sample-code/blob/b3e13798ae1093251f6b03830e4c30b5002e3c46/Filtered-Stream/filtered_stream.js#L145
async function setRules(rule) {

    const data = {
        'add': [{'value': rule}]
    }

    const response = await needle('post', rulesURL, data, {
        headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${token}`
        }
    })

    if (response.statusCode !== 201) {
        throw new Error(response.body);
    }

    return (response.body);

}

//Retrieved from https://github.com/twitterdev/Twitter-API-v2-sample-code/blob/b3e13798ae1093251f6b03830e4c30b5002e3c46/Filtered-Stream/filtered_stream.js#L145
function streamConnect(retryAttempt) {

    const stream = needle.get(streamURL, {
        headers: {
            "User-Agent": "v2FilterStreamJS",
            "Authorization": `Bearer ${token}`
        },
        timeout: 20000
    });

    stream.on('data', data => {
        try {
            const json = JSON.parse(data);
            console.log(json);

            //send tweet to socket
            io.emit('newTweet', json);


            // A successful connection resets retry count.
            retryAttempt = 0;
        } catch (e) {
            if (data.detail === "This stream is currently at the maximum allowed connection limit.") {
                console.log(data.detail)
                process.exit(1)
            } else {
                // Keep alive signal received. Do nothing.
            }
        }
    }).on('err', error => {
        if (error.code !== 'ECONNRESET') {
            console.log(error.code);
            process.exit(1);
        } else {
            // This reconnection logic will attempt to reconnect when a disconnection is detected.
            // To avoid rate limits, this logic implements exponential backoff, so the wait time
            // will increase if the client cannot reconnect to the stream. 
            setTimeout(() => {
                console.warn("A connection error occurred. Reconnecting...")
                streamConnect(++retryAttempt);
            }, 2 ** retryAttempt)
        }
    });

    return stream;

}


//Retrieved from https://github.com/twitterdev/Twitter-API-v2-sample-code/blob/b3e13798ae1093251f6b03830e4c30b5002e3c46/Filtered-Stream/filtered_stream.js#L145
(async () => {
    let currentRules;

    try {
        // Gets the complete list of rules currently applied to the stream
        currentRules = await getAllRules();

        // Delete all rules. Comment the line below if you want to keep your existing rules.
        await deleteAllRules(currentRules);

        // Add rules to the stream. Comment the line below if you don't want to add new rules.
        await setRules("start the stream");

    } catch (e) {
        console.error(e);
        process.exit(1);
    }

    // Listen to the stream.
    console.log("stream on");
    streamConnect(0);
})();

console.log('Listening on 3001');
server.listen(3001);