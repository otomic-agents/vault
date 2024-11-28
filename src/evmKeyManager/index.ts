import { Wallet } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import logger from '../logger';
import { config } from '../config';
import { promptText } from '../utils';

const keystoreFile = path.join(config.keystorePath, 'evm.json');

async function generateKeystore() {
    if (!fs.existsSync(config.keystorePath)) {
        fs.mkdirSync(config.keystorePath, { recursive: true });
    }

    if (fs.existsSync(keystoreFile)) {
        const replace = await promptText('Keystore already exists. Do you want to replace it? (yes/no): ');
        if (replace.toLowerCase() !== 'yes') {
            const keystore = fs.readFileSync(keystoreFile, 'utf-8');
            logger.log(`Public Key: 0x${JSON.parse(keystore).address}`);
            return;
        }
    }

    const password = await promptText('Enter a password to encrypt the keystore: ', true);
    const wallet = Wallet.createRandom();
    const keystore = await wallet.encrypt(password);

    fs.writeFileSync(keystoreFile, keystore);
    logger.log(`Public Key: ${wallet.address}`);
    logger.log(`Keystore saved to ${keystoreFile}`);
}

generateKeystore().catch((error) => {
    logger.error(`Error generating keystore: ${JSON.stringify(error)}`);
});
