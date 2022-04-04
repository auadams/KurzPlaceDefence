// ==UserScript==
// @name         KurrzDefence
// @namespace    https://github.com/auadams/KurzPlaceDefence
// @version      10
// @description  /r/kurzgesagt_place
// @author       austin
// @match        https://www.reddit.com/r/place/*
// @match        https://new.reddit.com/r/place/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @require	     https://cdn.jsdelivr.net/npm/toastify-js
// @resource     TOASTIFY_CSS https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css
// @updateURL    https://github.com/auadams/KurzPlaceDefence/raw/main/placedebot.user.js
// @downloadURL  https://github.com/auadams/KurzPlaceDefence/raw/main/placedebot.user.js
// @grant        GM_getResourceText
// @grant        GM_addStyle
// ==/UserScript==

// Ignore that hideous code. But if it works, it works.

const VERSION = 10;

const PLACE_URL = 'https://gql-realtime-2.reddit.com/query';
const UPDATE_URL = 'https://github.com/auadams/KurzPlaceDefence/raw/main/placedebot.user.js';

let accessToken;
let canvas = document.createElement('canvas');

let ccConnection;
let timeout;
let onCooldown;

(async function () {
	GM_addStyle(GM_getResourceText('TOASTIFY_CSS'));

	canvas.width = 2000;
	canvas.height = 2000;
	canvas = document.body.appendChild(canvas);

	await new Promise(r => setTimeout(r, 1000));

	await initToken();
	initServerConnection();
})();

async function initToken() {
	// Create AccessToken
	Toastify({
		text: 'Getting access tokens to...',
		duration: 10000,
		gravity: "bottom",
		style: {
			background: '#C6C6C6',
			color: '#111'
		},
	}).showToast();
	accessToken = await getAccessToken();
	Toastify({
		text: 'Got access tokens!',
		duration: 10000,
		gravity: "top",
		style: {
			background: '#92E234',
		},
	}).showToast();
}

async function initServerConnection() {
	// Establish connection to command&control server
	Toastify({
		text: 'Connect to the command server...',
		duration: 10000,
		gravity: "top,
		style: {
			background: '#C6C6C6',
			color: '#111'
		},
	}).showToast();

	ccConnection = new WebSocket('wss://topsneaky.birdbot.xyz');
	ccConnection.onopen = function () {
		Toastify({
			text: 'Connection to the server established!',
			duration: 10000,
			gravity: "top",
			style: {
				background: '#92E234',
			},
		}).showToast();

		// handshake
		ccConnection.send(JSON.stringify({"operation":"handshake","data":{"platform":"browser","version":VERSION,"useraccounts":1}}));
		setReady()
	}
	ccConnection.onerror = function (error) {
		Toastify({
			text: 'Connection to server failed!',
			duration: 10000,
			gravity: "top",
			style: {
				background: '#ED001C',
			},
		}).showToast();
		console.log('WebSocket Error: '+ error);
	};
	ccConnection.onclose = function (close) {
		Toastify({
			text: 'Connection to the server interrupted! Reconnect in 10 seconds...',
			duration: 10000,
			gravity: "top",
			style: {
				background: '#ED001C',
			},
		}).showToast();
		console.log('WebSocket Close: '+ close.code);
		if (close.code === 1006) {
			Toastify({
				text: 'Possible problem with your adblocker etc.',
				duration: 30000,
				gravity: "top",
				style: {
					background: '#ED001C',
				},
			}).showToast();
		}

		setTimeout(() => initServerConnection(), 10*1000);
	};
	ccConnection.onmessage  = processOperation;
}

function processOperation(message) {
	// console.log('WebSocket Message received: '+message.data);
	const messageData = JSON.parse(message.data);
	switch (messageData.operation) {
		case 'place-pixel':
			void processOperationPlacePixel(messageData.data);
			return;
		case 'notify-update':
			void processOperationNotifyUpdate(messageData.data);
			return;
	}
}

async function processOperationPlacePixel(data) {
	onCooldown = true;

	const x = data.x;
	const y = data.y;
	const color = data.color;

	const time = new Date().getTime();
	let nextAvailablePixelTimestamp = await place(x, y, color) ?? new Date(time + 1000 * 60 * 5 + 1000 * 15)

	// Sanity check timestamp
	if (nextAvailablePixelTimestamp < time || nextAvailablePixelTimestamp > time + 1000 * 60 * 5 + 1000 * 15) {
		nextAvailablePixelTimestamp = time + 1000 * 60 * 5 + 1000 * 15;
	}

	// Add a few random seconds to the next available pixel timestamp
	const waitFor = nextAvailablePixelTimestamp - time + (Math.random() * 1000 * 15);

	const minutes = Math.floor(waitFor / (1000 * 60))
	const seconds = Math.floor((waitFor / 1000) % 60)
	Toastify({
		text: `Still ${minutes}m ${seconds}s Cooldown to ${new Date(nextAvailablePixelTimestamp).toLocaleTimeString()} Clock`,
		duration: waitFor,
		gravity: "top",
		style: {
			background: '#FF5700',
		},
	}).showToast();
	timeout = setTimeout(setReady, waitFor);
}

async function processOperationNotifyUpdate(data) {
	Toastify({
		text: `New script version available! Download at ${UPDATE_URL}`,
		duration: 10000,
		gravity: "top",
		style: {
			background: '#ED001C',
		},
	}).showToast();
}

function setReady() {
	clearTimeout(timeout);
	onCooldown = false;
	ccConnection.send(JSON.stringify({"operation":"request-pixel","user":"browser-script"}));
	setTimeout(() => checkForIdle(), 60*1000);
}

function checkForIdle() {
	// send new request if server didn't answer with job
	if (!onCooldown) {
		setReady();
	}
}

function getCanvasId(x,y) {
	return (x > 1000) + (y > 1000) * 2;
}
/**
 * Places a pixel on the canvas, returns the "nextAvailablePixelTimestamp", if succesfull
 * @param x
 * @param y
 * @param color
 * @returns {Promise<number>}
 */
async function place(x, y, color) {
	const response = await fetch(PLACE_URL, {
		method: 'POST',
		body: JSON.stringify({
			'operationName': 'setPixel',
			'variables': {
				'input': {
					'actionName': 'r/replace:set_pixel',
					'PixelMessageData': {
						'coordinate': {
							'x': x % 1000,
							'y': y % 1000
						},
						'colorIndex': color,
						'canvasIndex': getCanvasId(x,y)
					}
				}
			},
			'query': `mutation setPixel($input: ActInput!) {
				act(input: $input) {
					data {
						... on BasicMessage {
							id
							data {
								... on GetUserCooldownResponseMessageData {
									nextAvailablePixelTimestamp
									__typename
								}
								... on SetPixelResponseMessageData {
									timestamp
									__typename
								}
								__typename
							}
							__typename
						}
						__typename
					}
					__typename
				}
			}
			`
		}),
		headers: {
			'origin': 'https://hot-potato.reddit.com',
			'referer': 'https://hot-potato.reddit.com/',
			'apollographql-client-name': 'mona-lisa',
			'Authorization': `Bearer ${accessToken}`,
			'Content-Type': 'application/json'
		}
	});
	const data = await response.json()
	if (data.errors !== undefined) {
		Toastify({
			text: 'Pixel could not be placed because of cooldown...',
			duration: 10000,
			gravity: "top",
			style: {
				background: '#ED001C',
			},
		}).showToast();
		return data.errors[0].extensions?.nextAvailablePixelTs
	}
	Toastify({
		text: `Pixel Placed at x:${x} y:${y}`,
		duration: 20000,
		gravity: "top",
		style: {
			background: '#92E234',
		},
	}).showToast();
	return data?.data?.act?.data?.[0]?.data?.nextAvailablePixelTimestamp
}

async function getAccessToken() {
	const usingOldReddit = window.location.href.includes('new.reddit.com');
	const url = usingOldReddit ? 'https://new.reddit.com/r/place/' : 'https://www.reddit.com/r/place/';
	const response = await fetch(url);
	const responseText = await response.text();

	return responseText.match(/"accessToken"\s*:\s*"([\w-]+)"/)[1];
}
