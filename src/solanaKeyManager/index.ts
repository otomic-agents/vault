import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import bs58 from 'bs58';
import logger from '../logger';
import { config } from '../config';
import { promptText, encrypt } from '../utils';

const keystoreFile = path.join(config.keystorePath, 'solana.json');

async function generateKeystore() {
    if (!fs.existsSync(config.keystorePath)) {
        fs.mkdirSync(config.keystorePath, { recursive: true });
    }

    if (fs.existsSync(keystoreFile)) {
        const replace = await promptText('Keystore already exists. Do you want to replace it? (yes/no): ');
        if (replace.toLowerCase() !== 'yes') {
            const keystore = JSON.parse(fs.readFileSync(keystoreFile, 'utf-8'));
            const publicKey = keystore.publicKey;
            logger.log(`Public Key: ${publicKey}`);
            return;
        }
    }

    const password = await promptText('Enter a password to encrypt the keystore: ', true);
    const keypair = Keypair.generate();
    const keystore = {
        publicKey: keypair.publicKey.toBase58(),
        secretKey: encrypt(bs58.encode(Buffer.from(keypair.secretKey)), password),
    };

    fs.writeFileSync(keystoreFile, JSON.stringify(keystore, null, 2));
    logger.log(`Public Key: ${keystore.publicKey}`);
    logger.log('Keystore saved to keystore/solana.json');
}

generateKeystore().catch((error) => {
    logger.error(`Error generating keystore: ${JSON.stringify(error)}`);
});
