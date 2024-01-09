import SpotifyWebApi from "spotify-web-api-node";
import dotenv from "dotenv";
import fs from "fs";
import fsPromise from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import axios from "axios";
import { QuickScore } from "quick-score";

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
	notFoundCount = 0;

	constructor() {
		super();
		this.__dirname = path.dirname(fileURLToPath(import.meta.url));
		this.tracksNotFound = [];
		this.trackIds = [];
		this.tracksNotFoundJsonPath = this.__dirname + "/tracksNotFound.json";
		this.tracksFoundJsonPath = this.__dirname + "/tracksFound.json";
		this.firstOneHundred = this.__dirname + "/firstonehundred.json";
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

	parseTrackObject = (track) => {
		// regext to spit string at `feat.`, `,`, `&`, `)`
		const regex = /\(feat\. |, |&|\)/;
		let [trackName, ...artistName] = track.track.split(regex);
		if (trackName.includes("(")) {
			trackName = trackName + ")";
		}
		artistName = artistName.map((t) => t.trim()).filter(Boolean);
		return {
			// remove extra spaces
			track: trackName.replace(/\s+/g, " ").trim(),
			artist: artistName,
		};
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
	searchTrack = async (trackQuery, listOfArtists) => {
		try {
			this.spotifyApi.setAccessToken(this.access_token);
			const trackDataJson = (await this.spotifyApi.searchTracks(trackQuery))?.body;
			const found = trackDataJson.tracks?.items.find((it) => {
				const trackArtist = it.artists;

				const names = trackArtist.reduce((acc, n) => {
					acc.push(n.name.toLowerCase());
					return acc;
				}, []);

				const qs = new QuickScore(names);

				const item = listOfArtists.every((n) => {
					const result = qs.search(n.toLowerCase());
					return result.length > 0;
				});

				return item;
			});

			if (found === undefined) {
				this.notFoundCount += 1;
				console.log("trackQuery", trackQuery);
				console.log("+".repeat(100), this.notFoundCount);
				return;
			}

			return {
				trackExternalUrl: found?.external_urls.spotify,
				trackId: found?.id,
				trackName: found?.name,
				trackUri: found?.uri,
			};
		} catch (err) {
			throw err;
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
			const track = shazamTracks[i];
			const regex = /[,&]/;
			let searchQuery = shazamTracks[i].q,
				artist = track.artist
					.split(regex)
					.map((a) => `${a.trim()},`)
					.join(" ");

			artist = artist.substring(0, artist.length - 1);

			const listOfArtists = track.artist.split(regex).map((a) => a.trim());

			if (track.track.includes("feat.")) {
				const { track: parsedTrackName, artist: parsedArtistName } = this.parseTrackObject(
					shazamTracks[i]
				);
				listOfArtists.push(...parsedArtistName);

				searchQuery = `track:${parsedTrackName} artist:${artist}`;
			} else {
				searchQuery = `track:${track.track} artist:${artist}`;
			}

			try {
				const response = await this.searchTrack(
					searchQuery,
					listOfArtists.map((n) => n.trim().toLowerCase())
				);

				if (response === undefined) {
					this.tracksNotFound.push({
						track: track.track,
						artist: track.artist,
						date: track.date,
						q: track.q,
					});
				} else {
					//
					this.trackIds.push(response?.trackUri);
					this.tracksNotFound.push({
						track: track.track,
						trackUri: response?.trackUri,
						url: `open.spotify.com/track/${response?.trackId}`,
					});
				}
			} catch (err) {
				throw err;
			}
			i += 1;
		}

		fs.createWriteStream(this.tracksFoundJsonPath, "");

		fs.appendFile(this.tracksNotFoundJsonPath, JSON.stringify(this.tracksNotFound), (err) => {
			if (err) throw err;
		});

		fs.appendFile(this.tracksFoundJsonPath, JSON.stringify(this.trackIds), (err) => {
			if (err) throw err;
		});
	};

	readTracksFoundJson = async () => {
		const tracksFound = await fsPromise.readFile(this.tracksFoundJsonPath, "utf8");
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
					await this.addTracksToPlaylistAPI(uris, accessToken);

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
