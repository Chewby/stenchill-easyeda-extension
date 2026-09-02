import path from 'node:path';
import fs from 'fs-extra';
import ignore from 'ignore';
import JSZip from 'jszip';

/**
 * Split a multi-line string into an array of strings
 */
export function multiLineStrToArray(str: string): Array<string> {
	return str.split(/[\r\n]+/);
}

/**
 * Check whether the UUID is valid
 */
export function testUuid(uuid?: string): uuid is string {
	const regExp = /^[a-z0-9]{32}$/;
	if (uuid && uuid !== '00000000000000000000000000000000') {
		return regExp.test(uuid.trim());
	}
	else {
		return false;
	}
}

/**
 * Get a valid UUID
 */
export function fixUuid(uuid?: string): string {
	uuid = uuid?.trim() || undefined;
	if (testUuid(uuid)) {
		return uuid.trim();
	}
	else {
		return crypto.randomUUID().replaceAll('-', '');
	}
}

/**
 * What a repository file is called INSIDE the package.
 *
 * The marketplace localises the listing, and the naming it reads is
 * `README.md` for the default plus `README.en.md` for an English visitor.
 * That is documented nowhere: it was measured on 2026-09-02, on
 * `eext-qrcode-generator`, which ships a Chinese `README.md` and an English
 * `README.en.md` and whose English detail page renders the latter. All eight
 * official extensions surveyed that day do the same, and no extension
 * anywhere uses a `zh-Hans` suffix.
 *
 * Following that convention in the REPOSITORY would turn the GitHub landing
 * page Chinese, because GitHub always renders the root `README.md` and offers
 * no way to point it elsewhere. The two names are therefore swapped here, at
 * packaging time and nowhere else: the repository reads English first, the
 * package carries the only layout the marketplace is known to read.
 *
 * The cost is that the package stops mirroring the repository file for file.
 * The contract test pins the names as they are IN THE ZIP, so the guard still
 * describes what ships.
 */
const PACKAGED_NAMES: Readonly<Record<string, string>> = {
	'README.md': 'README.en.md',
	'README.zh-Hans.md': 'README.md',
};

/**
 * The name a repository file takes inside the package.
 */
export function packagedName(filepath: string): string {
	return PACKAGED_NAMES[filepath] ?? filepath;
}

/**
 * Get the list of files to package
 */
export function getPackageFileList(rootDir: string): Array<string> {
	const filepathListWithoutFilter = fs.readdirSync(rootDir, { encoding: 'utf-8', recursive: true });
	const edaignoreListWithoutResolve = multiLineStrToArray(fs.readFileSync(path.join(rootDir, '.edaignore'), { encoding: 'utf-8' }));
	const edaignoreList: Array<string> = [];
	for (const edaignoreLine of edaignoreListWithoutResolve) {
		if (edaignoreLine.endsWith('/') || edaignoreLine.endsWith('\\')) {
			edaignoreList.push(edaignoreLine.slice(0, edaignoreLine.length - 1));
		}
		else {
			edaignoreList.push(edaignoreLine);
		}
	}
	const edaignore = ignore().add(edaignoreList);
	const filepathListWithoutResolve = edaignore.filter(filepathListWithoutFilter);
	const fileList: Array<string> = [];
	for (const filepath of filepathListWithoutResolve) {
		if (fs.lstatSync(path.join(rootDir, filepath)).isFile()) {
			fileList.push(filepath.replace(/\\/g, '/'));
		}
	}
	return fileList;
}

/**
 * Package the extension into an eext file
 */
export async function packageExtension(rootDir: string, outputPath: string): Promise<void> {
	const fileList = getPackageFileList(rootDir);

	const zip = new JSZip();
	const seen = new Set<string>();
	for (const file of fileList) {
		const name = packagedName(file);
		// A rename that lands on a name already taken would silently drop one of
		// the two files, and the package would install and work without it.
		if (seen.has(name)) {
			throw new Error(`Two files would be packaged as ${name}`);
		}
		seen.add(name);
		zip.file(name, fs.createReadStream(path.join(rootDir, file)));
	}

	const nodeStream = zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true, compression: 'DEFLATE', compressionOptions: { level: 9 } });
	const writeStream = fs.createWriteStream(outputPath);

	return new Promise((resolve, reject) => {
		nodeStream.pipe(writeStream);
		writeStream.on('finish', resolve);
		writeStream.on('error', reject);
		nodeStream.on('error', reject);
	});
}
