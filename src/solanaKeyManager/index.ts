import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import bs58 from 'bs58';
import logger from '../logger';
import { config } from '../config';
import { promptText, encrypt, decrypt } from '../utils';

const keystoreFile = path.join(config.keystorePath, 'solana.json');

async function generateKeystore() {
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

async function modifyKeystorePassword() {
    if (!fs.existsSync(keystoreFile)) {
        logger.error('Keystore file does not exist.');
        return;
    }

    const oldPassword = await promptText('Enter the current password: ', true);
    const keystore = JSON.parse(fs.readFileSync(keystoreFile, 'utf-8'));
    let secretKey: string;
    try {
        secretKey = decrypt(keystore.secretKey, oldPassword);
    } catch (error) {
        logger.error('Invalid current password.');
        return;
    }

    const newPassword = await promptText('Enter the new password: ', true);
    const newKeystore = {
        publicKey: keystore.publicKey,
        secretKey: encrypt(secretKey, newPassword),
    };

    fs.writeFileSync(keystoreFile, JSON.stringify(newKeystore, null, 2));
    logger.log(`Keystore password has been updated and saved to ${keystoreFile}`);
}

async function showPublicKey() {
    if (!fs.existsSync(keystoreFile)) {
        logger.error('Keystore file does not exist.');
        return;
    }

    const keystore = JSON.parse(fs.readFileSync(keystoreFile, 'utf-8'));
    logger.log(`Public Key: ${keystore.publicKey}`);
}

async function main() {
    if (!fs.existsSync(config.keystorePath)) {
        fs.mkdirSync(config.keystorePath, { recursive: true });
    }

    const action = await promptText(
        'Do you want to generate a new keystore, modify the password, or show the public key? (generate/modify/show): ',
    );
    if (action.toLowerCase() === 'generate') {
        await generateKeystore();
    } else if (action.toLowerCase() === 'modify') {
        await modifyKeystorePassword();
    } else if (action.toLowerCase() === 'show') {
        await showPublicKey();
    } else {
        logger.error('Invalid action.');
    }
}

main().catch((error) => {
    logger.error(`Error: ${JSON.stringify(error, null, 2)}`);
});
