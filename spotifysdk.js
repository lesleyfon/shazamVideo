import SpotifyWebApi from "spotify-web-api-node";
import dotenv from "dotenv";

dotenv.config();

const config = process.env;

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
	constructor() {
		super();
		this.clientId = config.CLIENT_ID;
		this.clientSecret = config.CLIENT_SECRET;
		this.tracksNotFound = [];
		this.trackIds = [];
	}

	getUserAccessToken = async () => {
		let spotifyApi = new SpotifyWebApi({
			clientId: this.clientId,
			clientSecret: this.clientSecret,
		});

		const credentialsRes = await spotifyApi.clientCredentialsGrant();
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
				`https://api.spotify.com/v1/search?q=${trackQuery}&type=track`,
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
	getTracksAndAddTracksToPlaylist = async (fs) => {
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

		fs.createWriteStream("tracksNotFound.json", "");
		fs.createWriteStream("tracksFound.json", "");

		fs.appendFile("tracksNotFound.json", JSON.stringify(this.tracksNotFound), (err) => {
			if (err) console.log(err);
		});

		fs.appendFile("tracksFound.json", JSON.stringify(this.trackIds), (err) => {
			if (err) console.log(err);
		});
	};

	// getTracksAndAddTracksToPlaylist = async (fs) => {}
}
