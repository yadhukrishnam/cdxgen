import { PackageURL } from "packageurl-js";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from 'os';
import { join } from 'path';
import got from 'got';
import { DEBUG_MODE} from "./utils.js";

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
    const url = `https://repo1.maven.org/maven2/${namespace.replaceAll(".", "/")}/${name.replaceAll(".", "/")}/${version}/${name}-${version}.pom`;
    
    if (DEBUG_MODE) {
        console.log(`Fetching POM from: ${url}`);
    }
    
    try {
        // got automatically throws for non-2xx responses and returns the body directly for text responses
        return await got.get(url).text();
    } catch (error) {
        if (error.response) {
            throw new Error(`Failed to fetch POM from Maven Central: HTTP ${error.response.statusCode} - ${error.response.statusMessage}`);
        } else {
            throw new Error(`Failed to fetch POM from Maven Central: ${error.message}`);
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
        default:
            console.error(`PURL type '${purlObject.type}' is not supported. Currently only 'maven' is supported.`);
            return false;
    }
};

export { generatePurlMetadata };
