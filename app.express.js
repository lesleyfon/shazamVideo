import express from "express";
import extractor from "./index.js";
import dotenv from "dotenv";

dotenv.config();

const { SPOTIFY_AUTH_BASE_URL, SPOTIFY_STATE, SPOTIFY_CALLBACK_URL, CLIENT_ID } = process.env;
const app = express();
const port = 3000;

app.get("/login", function (req, res) {
	res.redirect(
		`${SPOTIFY_AUTH_BASE_URL}?response_type=code&scope=playlist-read-private%20playlist-modify-private%20playlist-modify-public&state=${SPOTIFY_STATE}&show_dialog=true&client_id=${CLIENT_ID}&redirect_uri=${SPOTIFY_CALLBACK_URL}`
	);
});

app.get("/callback", async function (req, res) {
	const queryParams = req.query;
	const code = queryParams.code;

	const response = await extractor.addTracksToPlaylist(code);
	res.send(JSON.stringify(response, null, 2));
});

app.listen(port, () => {
	console.log("Server is running on http://localhost:3000/login");
});
