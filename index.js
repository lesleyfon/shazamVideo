import { createWorker } from "tesseract.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const screenshotDir = __dirname + "/screenshots";

const screenshotFileNames = fs.readdirSync(screenshotDir).sort((a, b) => (a > b ? 1 : -1));

// Sort the file names so that they are in order

/**
 * @description
 * 		1. create an output files
 * 		2. create a tesseract worker
 * 		3. for each screenshot file name
 * 			- recognize the text in the image
 * 			- write the text to the output file
 * 		4. close the worker
 */
(async () => {
	fs.createWriteStream("output.txt");
	const worker = await createWorker("eng");
	for (const screenshotFileName of screenshotFileNames) {
		const pathToScreenshot = screenshotDir + "/" + screenshotFileName;
		try {
			const ret = await worker.recognize(pathToScreenshot);
			const textData = ret.data.text;
			console.log("Writing to output data", screenshotFileName);
			const pathToOutputFile = __dirname + "/output.txt";
			fs.appendFile(pathToOutputFile, textData + "\n", (e) => {
				if (e) console.log(e);
			});
			console.log("Done Writing to output data", screenshotFileName);
		} catch (e) {
			console.log("Error at Image path,", pathToScreenshot);
			console.log(e);
		}
	}
	await worker.terminate();
})();

const pathToOutputFile = __dirname + "/output.txt";
const outputJson = "shazamOutput.json";
fs.createWriteStream(outputJson, "");

/**
 * @description
 * 1. read the output file
 * 2. split the data by new line
 * 3. remove empty strings
 * 4. return the array
 * @returns {string[]} fileDataArray
 */
const readOutputFile = () => {
	const fileData = fs.readFileSync(pathToOutputFile, "utf8");
	const fileDataArray = fileData.split("\n").filter(Boolean);

	fs.appendFile(outputJson, JSON.stringify(fileDataArray), (err) => {
		if (err) console.log(err);
	});

	return fileDataArray;
};

const fileDataArray = readOutputFile();
// If string begins with a month abbr and the next two elements are between 1-31, then it is a date

const regExpToMatchMonthNameAbbr =
	/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(0[1-9]|[12][0-9]|3[01]),\s\d{4}\b/g;

const n = fileDataArray.length;
const seen = new Set();
const shazamTracks = [];

for (let i = 0; i < n; i++) {
	const element = fileDataArray[i];
	const titleWithArtist = fileDataArray[i - 2] + " " + fileDataArray[i - 1];

	if (seen.has(titleWithArtist)) continue;

	const matches = element.match(regExpToMatchMonthNameAbbr);

	if (matches?.length) {
		shazamTracks.push({
			track: fileDataArray[i - 2],
			artist: fileDataArray[i - 1],
			q: `remaster%2520track:${encodeURI(fileDataArray[i - 2])}%2520artist:${encodeURI(
				fileDataArray[i - 1]
			)}`,
			date: matches[0],
		});
		seen.add(titleWithArtist);
	}
}

fs.createWriteStream("shaamTracks.json", "");

fs.appendFile("shaamTracks.json", JSON.stringify(shazamTracks), (err) => {
	if (err) console.log(err);
});
