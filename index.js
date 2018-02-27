var fs = require('fs');
var readline = require('readline');
var {google} = require('googleapis');
var OAuth2 = google.auth.OAuth2;

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/youtube-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/youtube.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'youtube-nodejs-quickstart.json';
var unique = {};

// Load client secrets from a local file.
fs.readFile('client_secret.json', function processClientSecrets(err, content) {
    if (err) {
        console.log('Error loading client secret file: ' + err);
        return;
    }
    // Authorize a client with the loaded credentials, then call the YouTube API.
    for(var i = 2; i < process.argv.length; i++) {
        authorize(JSON.parse(content), getChannelsByKeyword, process.argv[i]);
    }
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback, keyword) {
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var oauth2Client = new OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, "utf-8", function(err, token) {
        if (err) {
            getNewToken(oauth2Client, callback);
        } else {
            if(token == "") {
                getNewToken(oauth2Client, callback);
            } else {
                oauth2Client.credentials = JSON.parse(token);
                callback(oauth2Client, keyword);
            }
        }
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function(code) {
        rl.close();
        oauth2Client.getToken(code, function(err, token) {
            if (err) {
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            storeToken(token);
            callback(oauth2Client);
        });
    });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
    try {
        fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
        if (err.code != 'EEXIST') {
            throw err;
        }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the names and IDs of up to 10 files.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function getChannel(id, auth) {
    var service = google.youtube('v3');
    service.channels.list({
        auth: auth,
        part: 'snippet,contentDetails,statistics,contentOwnerDetails',
        id: id
    }, function(err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        var channels = response.data.items;
        if (channels.length == 0) {
            console.log('No channel found.');
        } else {
            console.log('%s,%s,%s,%s',
                channels[0].id,
                channels[0].snippet.title,
                channels[0].statistics.subscriberCount,
                'https://www.youtube.com/channel/' + channels[0].id + '/about');
        }
    });
}

function getChannelsByKeyword(auth, keyword) {
    var service = google.youtube('v3');
    service.search.list({
        auth: auth,
        part: 'snippet',
        regionCode: 'US',
        q: keyword,
        maxResults: 50,
    }, function(err, response) {
        if(err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        parseResponse(auth, response, 0);
    });
}

function getNextChannels(auth, token, dupes) {
    var service = google.youtube('v3');
    service.search.list({
        auth: auth,
        part: 'snippet',
        nextPageToken: token,
        maxResults: 50,
    }, function(err, response) {
        if(err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        parseResponse(auth, response, dupes);
    });
}

function parseResponse(auth, response, dupes) {
    var token = response.data.nextPageToken;
    response.data.items.forEach(function(value) {
        if(unique[value.snippet.channelId] == undefined) {
            getChannel(value.snippet.channelId, auth);
            unique[value.snippet.channelId] = true;
        } else {
            dupes++;
        }
    });

    if(token != undefined && dupes < 100) {
        getNextChannels(auth, token, dupes);
    }
}
