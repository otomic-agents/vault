import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import bs58 from 'bs58';
import logger from '../logger';
import { promptText, encrypt, decrypt, resolveKeystorePath, promptTextNoDefault } from '../utils';

async function generateKeystore() {
    const userInputKeystoreFile = await promptText(
        'Enter the full path for the keystore file (e.g., /path/to/keystore.json)',
        './solana-keystore.json'
    );
    const keystoreFile = resolveKeystorePath(userInputKeystoreFile);
    if (fs.existsSync(keystoreFile)) {
        const replace = await promptText('Keystore already exists. Do you want to replace it? (yes/no) ', 'no');
        if (replace.toLowerCase() !== 'yes') return;
    }

    const password = await promptTextNoDefault('Enter a password to encrypt the keystore:');
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
    const userInputKeystoreFile = await promptText(
        'Enter the full path for the keystore file (e.g., /path/to/keystore.json): ',
    );
    const keystoreFile = resolveKeystorePath(userInputKeystoreFile);

    if (!fs.existsSync(keystoreFile)) {
        logger.error('Keystore file does not exist.');
        return;
    }

    const oldPassword = await promptText('Enter the current password: ');
    const keystore = JSON.parse(fs.readFileSync(keystoreFile, 'utf-8'));
    let secretKey: string;
    try {
        secretKey = decrypt(keystore.secretKey, oldPassword);
    } catch (error) {
        logger.error('Invalid current password.');
        return;
    }

    const newPassword = await promptText('Enter the new password: ');
    const newKeystore = {
        publicKey: keystore.publicKey,
        secretKey: encrypt(secretKey, newPassword),
    };

    fs.writeFileSync(keystoreFile, JSON.stringify(newKeystore, null, 2));
    logger.log(`Keystore password has been updated and saved to ${keystoreFile}`);
}

async function showPublicKey() {
    const userInputKeystoreFile = await promptText(
        'Enter the full path for the keystore file (e.g., /path/to/keystore.json): ',
    );
    const keystoreFile = resolveKeystorePath(userInputKeystoreFile);

    if (!fs.existsSync(keystoreFile)) {
        logger.error('Keystore file does not exist.');
        return;
    }

    const keystore = JSON.parse(fs.readFileSync(keystoreFile, 'utf-8'));
    logger.log(`Public Key: ${keystore.publicKey}`);
}

async function main() {
    const action = await promptText(
        'Do you want to generate a new keystore, modify the password, or show the public key? (generate/modify/show) ',
        'generate'
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
