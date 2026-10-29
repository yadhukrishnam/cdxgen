import { PackageURL } from "packageurl-js";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from 'os';
import { join } from 'path';
import got from 'got';
import { DEBUG_MODE} from "./utils.js";

/**
 * Base URL used to resolve Maven artifacts.
 *
 * Honours the same MAVEN_CENTRAL_URL variable the rest of cdxgen already reads
 * (see getMvnMetadata in ./utils.js), so deployments behind a mirror or caching
 * proxy can avoid Maven Central's per-source-IP rate limiting.
 * @returns {string} - The base URL, without a trailing slash.
 */
const mavenBaseUrl = () =>
    (process.env.MAVEN_CENTRAL_URL || "https://repo1.maven.org/maven2/").replace(/\/+$/, "");

/**
 * Base URL used to resolve Go modules.
 *
 * Honours GOPROXY, taking only its first entry; the "direct" and "off"
 * sentinels fall back to the public proxy.
 * @returns {string} - The base URL, without a trailing slash.
 */
const goProxyBaseUrl = () => {
    const configured = (process.env.GOPROXY || "").split(/[,|]/)[0].trim();
    if (!configured || configured === "direct" || configured === "off") {
        return "https://proxy.golang.org";
    }
    return configured.replace(/\/+$/, "");
};

/**
 * Fetches the POM file content from Maven Central.
 * @param {PackageURL} purl - The package URL object.
 * @returns {Promise<string>} - The POM file content.
 * @throws {Error} - If the POM file cannot be fetched.
 */
const fetchPomFromMavenCentral = async (purl) => {
    if (!purl.namespace || !purl.name || !purl.version) {
        throw new Error(`Invalid PURL: missing required fields. Namespace, name, and version are required.`);
    }
    
    const { namespace, name, version } = purl;
    const url = `${mavenBaseUrl()}/${namespace.replaceAll(".", "/")}/${name.replaceAll(".", "/")}/${version}/${name}-${version}.pom`;
    
    if (DEBUG_MODE) {
        console.log(`Fetching POM from: ${url}`);
    }
    
    try {
        // got automatically throws for non-2xx responses and returns the body directly for text responses
        return await got.get(url).text();
    } catch (error) {
        if (error.response) {
            throw new Error(`Failed to fetch POM from ${mavenBaseUrl()}: HTTP ${error.response.statusCode} - ${error.response.statusMessage}`);
        } else {
            throw new Error(`Failed to fetch POM from ${mavenBaseUrl()}: ${error.message}`);
        }
    }
};

/**
 * Escapes capital letters in Go module paths for proxy.golang.org URLs.
 * Capital letters are replaced with '!' followed by the lowercase letter.
 * @param {string} path - The module path to escape.
 * @returns {string} - The escaped path.
 */
const escapeGoModulePath = (path) => {
    return path.replace(/[A-Z]/g, (match) => `!${match.toLowerCase()}`);
};

/**
 * Fetches the go.mod file content from proxy.golang.org.
 * @param {PackageURL} purl - The package URL object.
 * @returns {Promise<string>} - The go.mod file content.
 * @throws {Error} - If the go.mod file cannot be fetched.
 */
const fetchModFromGoProxy = async (purl) => {
    if (!purl.namespace || !purl.name || !purl.version) {
        throw new Error(`Invalid PURL: missing required fields. Namespace, name, and version are required.`);
    }

    const { namespace, name, version } = purl;

    // Construct the full module path
    // For Go, namespace is typically the domain/org (e.g., github.com/DataDog)
    // and name is the repo/module name (e.g., dd-trace-go)
    let modulePath = `${namespace}/${name}`;

    // Handle versioned modules (v2, v3, etc.)
    // Check if the version has a major version suffix
    const versionMatch = version.match(/^v(\d+)\./);
    if (versionMatch && parseInt(versionMatch[1]) >= 2) {
        modulePath = `${modulePath}/v${versionMatch[1]}`;
    }

    // Escape capital letters for proxy.golang.org
    const escapedPath = escapeGoModulePath(modulePath);

    const url = `${goProxyBaseUrl()}/${escapedPath}/@v/${version}.mod`;

    if (DEBUG_MODE) {
        console.log(`Fetching go.mod from: ${url}`);
    }

    try {
        return await got.get(url).text();
    } catch (error) {
        if (error.response) {
            throw new Error(`Failed to fetch go.mod from Go proxy: HTTP ${error.response.statusCode} - ${error.response.statusMessage}`);
        } else {
            throw new Error(`Failed to fetch go.mod from Go proxy: ${error.message}`);
        }
    }
};

/**
 * Creates a pom.xml file with the specified dependency from the purl.
 * @param {PackageURL} purl - The package URL object.
 * @returns {Promise<string>} - The path to the generated pom.xml file.
 * @throws {Error} - If the POM file cannot be created.
 */
const createPomFile = async (purl) => {
    try {
        // Fetch the POM content from Maven Central
        const pomContent = await fetchPomFromMavenCentral(purl);

        // Create a temporary directory for the POM file
        const tempDir = mkdtempSync(join(tmpdir(), 'pom-'));
        const pomPath = join(tempDir, 'pom.xml');

        // Write the POM content to the file
        writeFileSync(pomPath, pomContent);

        if (DEBUG_MODE) {
            console.log(`POM file created at: ${pomPath}`);
            console.log(`POM content size: ${pomContent.length} bytes`);
        }

        return pomPath;
    } catch (error) {
        console.error(`Failed to create POM file: ${error.message}`);
        // Re-throw the error with more context
        throw new Error(`Failed to create POM file for ${purl.toString()}: ${error.message}`);
    }
};

/**
 * Creates a go.mod file with the specified dependency from the purl.
 * @param {PackageURL} purl - The package URL object.
 * @returns {Promise<string>} - The path to the generated go.mod file.
 * @throws {Error} - If the go.mod file cannot be created.
 */
const createModFile = async (purl) => {
    try {
        // Fetch the go.mod content from Go proxy
        const modContent = await fetchModFromGoProxy(purl);

        // Create a temporary directory for the go.mod file
        const tempDir = mkdtempSync(join(tmpdir(), 'gomod-'));
        const modPath = join(tempDir, 'go.mod');

        // Write the go.mod content to the file
        writeFileSync(modPath, modContent);

        if (DEBUG_MODE) {
            console.log(`go.mod file created at: ${modPath}`);
            console.log(`go.mod content size: ${modContent.length} bytes`);
        }

        return modPath;
    } catch (error) {
        console.error(`Failed to create go.mod file: ${error.message}`);
        // Re-throw the error with more context
        throw new Error(`Failed to create go.mod file for ${purl.toString()}: ${error.message}`);
    }
};

/**
 * Generates metadata files for the specified purl.
 * @param {PackageURL} purlObject - The package URL object.
 * @returns {Promise<string|boolean>} - The path to the generated metadata file, or false if not supported.
 * @throws {Error} - If the metadata cannot be generated.
 */
const generatePurlMetadata = async (purlObject) => {
    if (!purlObject || !purlObject.type) {
        throw new Error('Invalid PURL object: missing type');
    }
    
    if (DEBUG_MODE) {
        console.log(`Generating metadata for PURL: ${purlObject.toString()}`);
    }
    
    switch (purlObject.type) {
        case 'maven':
            return await createPomFile(purlObject);
        case 'golang':
            return await createModFile(purlObject);
        default:
            console.error(`PURL type '${purlObject.type}' is not supported. Currently only 'maven' and 'golang' are supported.`);
            return false;
    }
};

export { generatePurlMetadata };
