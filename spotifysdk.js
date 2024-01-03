import SpotifyWebApi from "spotify-web-api-node";
import dotenv from "dotenv";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import axios from "axios";

dotenv.config();

const {
	CLIENT_ID,
	CLIENT_SECRET,
	SPOTIFY_CALLBACK_URL,
	ENCODED_SPOTIFY_CALLBACK_URL,
	PLAYLIST_ID,
	SPOTIFY_API_BASE_URL,
	SPOTIFY_TOKEN_API_BASE_URL,
} = process.env;

/**
 * 	1. Read shazam json
 * 	2. Iterate through each track
 * 	3. Search for track on spotify
 * 	4. If track is found,
 * 			4.1. Add track to trackIds array
 */

export default class SpotifyWrapper extends SpotifyWebApi {
	access_token;
	shazamTracksOutputJsonData;
	playlistId = PLAYLIST_ID;
	encodedRedirectURI = ENCODED_SPOTIFY_CALLBACK_URL;
	authorization = `Basic ${new Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`;
	spotifyAPIBaseURL = SPOTIFY_API_BASE_URL;
	spotifyTokenAPIBaseURL = SPOTIFY_TOKEN_API_BASE_URL;
	redirectUri = SPOTIFY_CALLBACK_URL;
	clientId = CLIENT_ID;
	clientSecret = CLIENT_SECRET;
	constructor() {
		super();
		this.__dirname = path.dirname(fileURLToPath(import.meta.url));
		this.tracksNotFound = [];
		this.trackIds = [];
		this.tracksNotFoundJsonPath = "/tracksNotFound.json";
		this.tracksFoundJsonPath = "/tracksFound.json";
		this.spotifyApi = new SpotifyWebApi({
			clientId: this.clientId,
			clientSecret: this.clientSecret,
		});
	}

	getUserAccessToken = async () => {
		this.spotifyApi = new SpotifyWebApi({
			clientId: this.clientId,
			clientSecret: this.clientSecret,
			redirectUri: this.redirectUri,
		});

		const credentialsRes = await this.spotifyApi.clientCredentialsGrant();
		const access_token = credentialsRes.body.access_token;

		return access_token;
	};

	sleep = (ms) => {
		return new Promise((resolve) => setTimeout(resolve, ms));
	};

	/**
	 * @description
	 * 		1. Search for track on spotify
	 * 		2. If artist name has more than one artist, and includes `&`, or `,`
	 * 				2.1. Split artist name into array of artists
	 * 				2.2. Iterate through the trackDataJson.tracks.items array
	 * 						2.2.1. Iterate through each artist in the album.artists array
	 * 										2.2.1.1 if artist name is in the list of artists, return the track
	 * 		3. If artist name has only one artist
	 * 				3.1. Return the first track in the trackDataJson.tracks.items array
	 * @param {string} trackQuery
	 * @param {string} artistName
	 * @returns {object} trackDataJson.tracks.items[0]
	 *
	 *
	 * */
	searchTrack = async (trackQuery, artistName) => {
		try {
			const trackData = await fetch(
				`${this.spotifyAPIBaseURL}search?q=${trackQuery}&type=track`,
				{
					headers: {
						Authorization: `Bearer ${this.access_token}`,
					},
				}
			);
			const trackDataJson = await trackData.json();

			const regex = /[,&]/;
			if (regex.test(artistName)) {
				const listOfArtists = artistName.split(regex).map((it) => it.trim());
				const found = trackDataJson.tracks?.items.find((it) => {
					const item = it.album.artists.every((artist) => {
						return listOfArtists.includes(artist.name);
					});
					return item;
				});
				return {
					trackExternalUrl: found?.external_urls.spotify,
					trackId: found?.id,
					trackName: found?.name,
					trackUri: found?.uri,
				};
			} else {
				// Add a filter here similar to the one above, to check if the artist name is in the list of artists and the track name matches partially
				return {
					trackExternalUrl: trackDataJson.tracks?.items[0].external_urls.spotify,
					trackId: trackDataJson.tracks?.items[0].id,
					trackName: trackDataJson.tracks?.items[0].name,
					trackUri: trackDataJson.tracks?.items[0].uri,
				};
			}
		} catch (err) {
			console.log(err);
		}
	};

	/**
	 * @description
	 * 	1. Read shazam json
	 * 	2. Iterate through each track
	 * 	3. Search for track on spotify
	 * 	4. If track is found,
	 * 			4.1. Add track to trackIds array
	 * 			4.2. if track is not found, add track to tracksNotFound array
	 * 	5. Write tracksNotFound array to file
	 * 	6. Write trackIds array to file
	 */
	getTracksAndAddTracksToPlaylist = async () => {
		const shazamTracks = JSON.parse(this.shazamTracksOutputJsonData);
		const length = shazamTracks.length;
		let i = 0;
		while (i < length) {
			console.log("i", i);
			const track = shazamTracks[i];
			try {
				const response = await this.searchTrack(track.q, track.artist);
				this.trackIds.push(response?.trackUri);

				if (!!response?.trackUri === false) {
					this.tracksNotFound.push({
						track: track.track,
						artist: track.artist,
						date: track.date,
						q: track.q,
					});
				}
			} catch (err) {
				console.log(err);
			}
			i += 1;
		}

		fs.createWriteStream(this.tracksNotFoundJsonPath, "");
		fs.createWriteStream(this.tracksFoundJsonPath, "");

		fs.appendFile(this.tracksNotFoundJsonPath, JSON.stringify(this.tracksNotFound), (err) => {
			if (err) console.log(err);
		});

		fs.appendFile(this.tracksFoundJsonPath, JSON.stringify(this.trackIds), (err) => {
			if (err) console.log(err);
		});
	};

	readTracksFoundJson = async () => {
		const tracksFound = await fs.readFile(this.__dirname + this.tracksFoundJsonPath, "utf8");
		return JSON.parse(tracksFound).filter(Boolean);
	};

	buildAPITokenQuery = (code) => {
		return Object.entries({
			code,
			grant_type: "authorization_code",
			redirect_uri: this.encodedRedirectURI,
		})
			.reduce((acc, [key, value]) => acc + `${key}=${value}&`, "")
			.slice(0, -1);
	};

	getSpotifyAccessToken = async (code) => {
		const queryData = this.buildAPITokenQuery(code);

		try {
			const response = await axios({
				method: "post",
				url: this.spotifyTokenAPIBaseURL,
				data: queryData,
				headers: {
					"content-type": "application/x-www-form-urlencoded",
					Authorization: this.authorization,
				},
			});

			return response;
		} catch (err) {
			throw err;
		}
	};

	addTracksToPlaylistAPI = async (uris, accessToken) => {
		try {
			const response = await axios({
				method: "post",
				url: `${this.spotifyAPIBaseURL}/playlists/${this.playlistId}/tracks`,
				data: {
					uris,
				},
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			});

			if (response.status === 201) {
				return "Added songs to playlist";
			} else {
				return response;
			}
		} catch (error) {
			throw error;
		}
	};

	addTracksToPlaylist = async (code) => {
		try {
			const parsedTracksFound = await this.readTracksFoundJson();

			const accessTokenResponse = await this.getSpotifyAccessToken(code);
			const accessToken = accessTokenResponse.data.access_token;

			if (accessTokenResponse.status === 200) {
				let i = 0;
				while (i < parsedTracksFound.length) {
					const uris = parsedTracksFound.slice(i, i + 100);

					await addTracksToPlaylistAPI(uris, accessToken);

					i += 100;
				}
			} else {
				return accessTokenResponse;
			}
		} catch (err) {
			return err;
		}
	};
}
