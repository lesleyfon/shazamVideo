import { createWorker } from "tesseract.js";
import SpotifyWebApi from "./spotifysdk.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

class ShazamTrackExtractor extends SpotifyWebApi {
	constructor() {
		super();
		this.__dirname = path.dirname(fileURLToPath(import.meta.url));
		this.screenshotDir = this.__dirname + "/screenshots";
		this.screenshotFileNames = fs
			.readdirSync(this.screenshotDir)
			.sort((a, b) => (a > b ? 1 : -1));
		this.pathToOutputFile = this.__dirname + "/output.txt";
		this.outputJson = "shazamOutput.json";
		this.shazamTracksOutputPath = "/shazamTracks.json";

		this.regExpToMatchMonthNameAbbr =
			/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(0[1-9]|[12][0-9]|3[01]),\s\d{4}\b/g;
	}

	async extractTextFromImages() {
		fs.createWriteStream("output.txt");
		const worker = await createWorker("eng");
		for (const screenshotFileName of this.screenshotFileNames) {
			const pathToScreenshot = this.screenshotDir + "/" + screenshotFileName;
			try {
				const ret = await worker.recognize(pathToScreenshot);
				const textData = ret.data.text;
				console.log("Writing to output data", screenshotFileName);
				fs.appendFile(this.pathToOutputFile, textData + "\n", (e) => {
					if (e) console.log(e);
				});
				console.log("Done Writing to output data", screenshotFileName);
			} catch (e) {
				console.log("Error at Image path,", pathToScreenshot);
				console.log(e);
			}
		}
		await worker.terminate();
	}

	readOutputFile() {
		const fileData = fs.readFileSync(this.pathToOutputFile, "utf8");
		const fileDataArray = fileData.split("\n").filter(Boolean);

		fs.appendFile(
			this.outputJson,
			JSON.stringify(fileDataArray),
			(err) => err && console.log(err)
		);

		return fileDataArray;
	}

	extractShazamTracks() {
		const fileDataArray = this.readOutputFile();
		const n = fileDataArray.length;
		const seen = new Set();
		const shazamTracks = [];

		for (let i = 0; i < n; i++) {
			const element = fileDataArray[i];
			const titleWithArtist = fileDataArray[i - 2] + " " + fileDataArray[i - 1];

			if (seen.has(titleWithArtist)) continue;

			const matches = element.match(this.regExpToMatchMonthNameAbbr);

			if (matches?.length) {
				shazamTracks.push({
					track: fileDataArray[i - 2],
					artist: fileDataArray[i - 1],
					q: `remaster%2520track:${encodeURI(
						fileDataArray[i - 2]
					)}%2520artist:${encodeURI(fileDataArray[i - 1])}`,
					date: matches[0],
				});
				seen.add(titleWithArtist);
			}
		}

		fs.createWriteStream("shazamTracks.json", "");

		fs.appendFile("shazamTracks.json", JSON.stringify(shazamTracks), (err) => {
			if (err) console.log(err);
		});
	}

	getShazamJsonOutputData = (path, fs) => {
		return new Promise((resolve, reject) => {
			fs.readFile(path + this.shazamTracksOutputPath, "utf8", (err, data) => {
				if (err) {
					reject(err);
				}
				resolve(data);
			});
		});
	};

	async run() {
		// Get and set spotify access data
		this.access_token = await this.getUserAccessToken();
		this.setAccessToken(this.access_token);

		this.shazamTracksOutputJsonData = await this.getShazamJsonOutputData(this.__dirname, fs);
		// this.getTracksAndAddTracksToPlaylist(fs);
	}
}

const extractor = new ShazamTrackExtractor();

extractor.run();
