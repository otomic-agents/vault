import { Wallet } from 'ethers';
import * as fs from 'fs';
import * as readline from 'readline';
import logger from '../logger';

const keystoreFile = 'keystore/evm.json';

async function promptPassword(promptText: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(promptText, (input) => {
            rl.close();
            resolve(input);
        });
    });
}

async function generateKeystore() {
    if (fs.existsSync(keystoreFile)) {
        const replace = await promptPassword('Keystore already exists. Do you want to replace it? (yes/no): ');
        if (replace.toLowerCase() !== 'yes') {
            const keystore = fs.readFileSync(keystoreFile, 'utf-8');
            const password = await promptPassword('Enter the password to decrypt the keystore: ');
            const wallet = await Wallet.fromEncryptedJson(keystore, password);
            logger.log(`Public Key: ${wallet.address}, Private Key: ${wallet.privateKey}`);
            return;
        }
    }

    const password = await promptPassword('Enter a password to encrypt the keystore: ');
    const wallet = Wallet.createRandom();
    const keystore = await wallet.encrypt(password);

    fs.writeFileSync(keystoreFile, keystore);
    logger.log(`Public Key: ${wallet.address}`);
    logger.log(`Keystore saved to ${keystoreFile}`);
}

generateKeystore().catch((error) => {
    logger.error(`Error generating keystore: ${JSON.stringify(error)}`);
});
