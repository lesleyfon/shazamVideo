import SpotifyWebApi from "spotify-web-api-node";
import dotenv from "dotenv";

dotenv.config();

const config = process.env;

export default class SpotifyWrapper extends SpotifyWebApi {
	access_token;
	constructor() {
		super();
		this.clientId = config.CLIENT_ID;
		this.clientSecret = config.CLIENT_SECRET;
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

	searchTrack = async (trackQuery) => {
		const trackData = await fetch(
			`https://api.spotify.com/v1/search?q=${trackQuery}&type=track`,
			{
				headers: {
					Authorization: `Bearer ${this.access_token}`,
				},
			}
		);
		const trackDataJson = await trackData.json();
		const trackExternalUrl = trackDataJson.tracks.items[0].external_urls.spotify;
		const trackId = trackDataJson.tracks.items[0].id;
		const trackName = trackDataJson.tracks.items[0].name;

		return {
			trackExternalUrl,
			trackId,
			trackName,
		};
	};
}
