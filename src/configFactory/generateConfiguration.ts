import logger from '../logger';
import * as fs from 'fs';
import { promptText, promptTextNoDefault, resolveKeystorePath } from '../utils';
import * as yaml from 'js-yaml';

const defEvmKeystorePath = './evm-keystore.json';
const defSolanaKeystorePath = './solana-keystore.json';

async function main() {
    // console.log('generate-config')

    const args = process.argv;

    // console.log('argv:', args);

    const evm = args.indexOf('--evm') != -1;
    const solana = args.indexOf('--solana') != -1;

    // check args
    if (evm == false && solana == false) {
        logger.warn(
            'Use "-- --evm" to generate the configuration for the EVM signature server, or use "-- --solana" to generate the configuration for the Solana signature server. If you want to configure both EVM and Solana at the same time, use "-- --evm --solana".',
        );
        return;
    }

    // get evm info
    let evmKeystoreFile = '';
    let evmPassword = '';
    if (evm == true) {
        evmKeystoreFile = defEvmKeystorePath;
        while (!fs.existsSync(evmKeystoreFile)) {
            const pathEvmKeystore = await promptTextNoDefault(
                `Could not find the EVM keystore file at path ${defEvmKeystorePath}, please enter your keystore file path:`,
            );
            evmKeystoreFile = pathEvmKeystore;
        }

        evmPassword = await promptTextNoDefault(`Please enter your EVM keystore password:`);
    }

    // get solana info
    let solanaKeystoreFile = '';
    let solanaPassword = '';
    if (solana == true) {
        solanaKeystoreFile = defSolanaKeystorePath;
        while (!fs.existsSync(solanaKeystoreFile)) {
            const pathEvmKeystore = await promptTextNoDefault(
                `Could not find the Solana keystore file at path ${defSolanaKeystorePath}, please enter your keystore file path:`,
            );
            solanaKeystoreFile = pathEvmKeystore;
        }

        solanaPassword = await promptTextNoDefault(`Please enter your Solana keystore password:`);
    }

    // get start port
    const port = await promptText(`Please enter the port to start the service`, '19000');

    // get lpnode ip
    const ip = await promptTextNoDefault(
        `Please enter the IP address of the device running the Otmoic LPNode program(If the signature server is on the same local network, you should enter its internal IP address):`,
    );

    // create signer dir
    initSignerDir();

    // copy config template
    copyTemplate(evmKeystoreFile, solanaKeystoreFile);

    // rewrite config
    await rewriteConfig(evm, solana, evmKeystoreFile, solanaKeystoreFile, evmPassword, solanaPassword, port, ip);
}

const initSignerDir = () => {
    // Define the directory path
    const dirPath = './signer';

    // Check if the directory exists
    if (!fs.existsSync(dirPath)) {
        // If the directory does not exist, create it
        fs.mkdirSync(dirPath);
        fs.mkdirSync(`${dirPath}/keys`);
        console.log(`Directory ${dirPath} created.`);
    } else {
        // If the directory exists, check if it is empty
        const files = fs.readdirSync(dirPath);
        if (files.length > 0) {
            // If the directory is not empty, rename it
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // Generate a timestamp
            const backupDirPath = `./signer-backup-${timestamp}`;
            fs.renameSync(dirPath, backupDirPath);
            console.log(`Directory ${dirPath} renamed to ${backupDirPath}.`);

            // Create a new signer directory
            fs.mkdirSync(dirPath);
            fs.mkdirSync(`${dirPath}/keys`);
            console.log(`New directory ${dirPath} created.`);
        }
    }
};

const copyTemplate = (evmKeystoreFile: string, solanaKeystoreFile: string) => {
    // Define source and destination paths
    const filesToCopy = [
        { src: './docker-compose-lp.yml', dest: './signer/docker-compose.yml' },
        { src: './front_nginx.conf', dest: './signer/front_nginx.conf' },
        { src: './nginx-lp-base.conf', dest: './signer/nginx.conf' },
    ];
    if (evmKeystoreFile != '') {
        filesToCopy.push({ src: evmKeystoreFile, dest: './signer/keys/evm-keystore.json' });
    }
    if (solanaKeystoreFile != '') {
        filesToCopy.push({ src: solanaKeystoreFile, dest: './signer/keys/solana-keystore.json' });
    }

    // Ensure the destination directory exists
    const destDir = './signer';
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir);
        console.log(`Directory ${destDir} created.`);
    }

    // Copy files
    filesToCopy.forEach((file) => {
        try {
            fs.copyFileSync(file.src, file.dest);
            console.log(`Copied ${file.src} to ${file.dest}`);
        } catch (error) {
            console.error(`Error copying ${file.src} to ${file.dest}:`, error);
        }
    });
};

const rewriteConfig = async (
    evm: boolean,
    solana: boolean,
    evmKeystoreFile: string,
    solanaKeystoreFile: string,
    evmPassword: string,
    solanaPassword: string,
    port: string,
    ip: string,
) => {
    if (evm == false) {
        console.log('remove evm config');
        await rewriteRemoveEVMConfigDockerCompose();
    }

    if (solana == false) {
        console.log('remove solana config');
        await rewriteRemoveSolanaConfigDockerCompose();
    }

    if (evm == true) {
        await rewriteEVMConfigNginx();
        await rewriteEVMPassword(evmPassword);
    }

    if (solana == true) {
        await rewriteSolanaConfigNginx();
        await rewriteSolanaPassword(solanaPassword);
    }

    await rewriteSignerListenPort(port);

    await rewriteWhiteLists(ip);
};

const rewriteRemoveEVMConfigDockerCompose = () =>
    new Promise<void>((resolve, reject) => {
        const filePath = './signer/docker-compose.yml';

        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading file: ${err}`);
                return;
            }

            const doc: any = yaml.load(data);
            delete doc.services.lp_evm_sign;
            if (doc.services && doc.services.nginx && doc.services.nginx.depends_on) {
                const dependsOn = doc.services.nginx.depends_on;
                const index = dependsOn.indexOf('lp_evm_sign');
                if (index !== -1) {
                    dependsOn.splice(index, 1);
                }
            }

            const modifiedData = yaml.dump(doc);

            fs.writeFile(filePath, modifiedData, 'utf8', (err) => {
                if (err) {
                    console.error(`Error writing file: ${err}`);
                    return;
                }
                console.log(`File ${filePath} has been updated successfully.`);
                resolve();
            });
        });
    });

const rewriteRemoveSolanaConfigDockerCompose = () =>
    new Promise<void>((resolve, reject) => {
        const filePath = './signer/docker-compose.yml';

        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading file: ${err}`);
                return;
            }

            const doc: any = yaml.load(data);
            delete doc.services.lp_solana_sign;
            if (doc.services && doc.services.nginx && doc.services.nginx.depends_on) {
                const dependsOn = doc.services.nginx.depends_on;
                const index = dependsOn.indexOf('lp_solana_sign');
                if (index !== -1) {
                    dependsOn.splice(index, 1);
                }
            }
            const modifiedData = yaml.dump(doc);

            fs.writeFile(filePath, modifiedData, 'utf8', (err) => {
                if (err) {
                    console.error(`Error writing file: ${err}`);
                    return;
                }
                console.log(`File ${filePath} has been updated successfully.`);
                resolve();
            });
        });
    });

const rewriteEVMConfigNginx = () =>
    new Promise<void>((resolve, reject) => {
        // Define the path to the nginx configuration file
        const filePath = './signer/nginx.conf';

        // Reading a file
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading file: ${err}`);
                return;
            }

            // Define the location configuration to be added
            const newLocationConfig = `

        # Forward to lp_evm_sign service
        location /lp/9006/ {
            proxy_pass http://lp_evm_sign:9100/; # Forward to lp_evm_sign service
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
        # Forward to lp_evm_sign service
        location /lp/60/ {
            proxy_pass http://lp_evm_sign:9100/; # Forward to lp_evm_sign service
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
        # Forward to lp_evm_sign service
        location /lp/614/ {
            proxy_pass http://lp_evm_sign:9100/; # Forward to lp_evm_sign service
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
        `;

            // Add a new location configuration in the server block
            const modifiedData = data.replace(/(server\s*{[\s\S]*?})(\s*})/, `$1${newLocationConfig}$2`);

            // Write the modified data back to the file
            fs.writeFile(filePath, modifiedData, 'utf8', (err) => {
                if (err) {
                    console.error(`Error writing file: ${err}`);
                    return;
                }
                console.log(`File ${filePath} has been updated successfully.`);
                setTimeout(resolve, 1000);
            });
        });
    });

const rewriteSolanaConfigNginx = () =>
    new Promise<void>((resolve, reject) => {
        // Define the path to the nginx configuration file
        const filePath = './signer/nginx.conf';

        // Reading a file
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading file: ${err}`);
                return;
            }

            // Define the location configuration to be added
            const newLocationConfig = `
        # Forward to lp_solana_sign service
        location /lp/501/ {
            proxy_pass http://lp_solana_sign:9100/; # Forward to lp_solana_sign service
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
        `;

            // Add a new location configuration in the server block
            const modifiedData = data.replace(/(server\s*{[\s\S]*?})(\s*})/, `$1${newLocationConfig}$2`);

            // Write the modified data back to the file
            fs.writeFile(filePath, modifiedData, 'utf8', (err) => {
                if (err) {
                    console.error(`Error writing file: ${err}`);
                    return;
                }
                console.log(`File ${filePath} has been updated successfully.`);
                setTimeout(resolve, 1000);
            });
        });
    });

const rewriteEVMPassword = (password: string) =>
    new Promise<void>((resolve, reject) => {
        const filePath = './signer/docker-compose.yml';

        // Read the file
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading file: ${err}`);
                return;
            }

            // Parse the YAML file
            const doc = yaml.load(data) as any;

            if (doc.services && doc.services.lp_evm_sign && doc.services.lp_evm_sign.environment) {
                doc.services.lp_evm_sign.environment.VAULT_PASSWORD = password; // update VAULT_PASSWORD
            }

            // Convert the modified object back to YAML format
            const modifiedData = yaml.dump(doc);

            // Write the modified data back to the file
            fs.writeFile(filePath, modifiedData, 'utf8', (err) => {
                if (err) {
                    console.error(`Error writing file: ${err}`);
                    return;
                }
                console.log(`File ${filePath} has been updated successfully.`);
                resolve();
            });
        });
    });

const rewriteSolanaPassword = (password: string) =>
    new Promise<void>((resolve, reject) => {
        const filePath = './signer/docker-compose.yml';

        // Read the file
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading file: ${err}`);
                return;
            }

            // Parse the YAML file
            const doc = yaml.load(data) as any;

            if (doc.services && doc.services.lp_solana_sign && doc.services.lp_solana_sign.environment) {
                doc.services.lp_solana_sign.environment.VAULT_PASSWORD = password; // update VAULT_PASSWORD
            }

            // Convert the modified object back to YAML format
            const modifiedData = yaml.dump(doc);

            // Write the modified data back to the file
            fs.writeFile(filePath, modifiedData, 'utf8', (err) => {
                if (err) {
                    console.error(`Error writing file: ${err}`);
                    return;
                }
                console.log(`File ${filePath} has been updated successfully.`);
                resolve();
            });
        });
    });

const rewriteSignerListenPort = (port: string) =>
    new Promise<void>((resolve, reject) => {
        const filePath = './signer/front_nginx.conf';

        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading file: ${err}`);
                return;
            }

            const modifiedData = data.replace(/(listen\s*)19000/, `$1${port}`);

            fs.writeFile(filePath, modifiedData, 'utf8', (err) => {
                if (err) {
                    console.error(`Error writing file: ${err}`);
                    return;
                }
                console.log(`File ${filePath} has been updated successfully.`);
            });
        });
    });

const rewriteWhiteLists = (ip: string) =>
    new Promise<void>((resolve, reject) => {
        // Define the path to the docker-compose file
        const filePath = './signer/docker-compose.yml';

        // Reading the YAML file
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading file: ${err}`);
                return;
            }

            // Parse the YAML file
            let doc;
            try {
                doc = yaml.load(data);
            } catch (e) {
                console.error(`Error parsing YAML: ${e}`);
                return;
            }

            // Modify the IP address in the document
            // Assuming the IP address is in a specific field, you need to adjust this according to your YAML structure
            const replaceIpInDoc = (obj: any) => {
                for (const key in obj) {
                    if (typeof obj[key] === 'string') {
                        obj[key] = obj[key].replace(/172\.31\.17\.72/g, ip);
                    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                        replaceIpInDoc(obj[key]);
                    }
                }
            };

            replaceIpInDoc(doc);

            // Convert the modified object back to YAML format
            const modifiedData = yaml.dump(doc);

            // Write the modified data back to the file
            fs.writeFile(filePath, modifiedData, 'utf8', (err) => {
                if (err) {
                    console.error(`Error writing file: ${err}`);
                    return;
                }
                console.log(`File ${filePath} has been updated successfully.`);
                setTimeout(resolve, 1000);
            });
        });
    });

main().catch((error) => {
    logger.error(`Error: ${JSON.stringify(error, null, 2)}`);
});
