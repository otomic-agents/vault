import { HDNodeWallet, Wallet } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import logger from '../logger';
import { config } from '../config';
import { promptText } from '../utils';

const keystoreFile = path.join(config.keystorePath, 'evm.json');

async function generateKeystore() {
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

async function modifyKeystorePassword() {
    if (!fs.existsSync(keystoreFile)) {
        logger.error('Keystore file does not exist.');
        return;
    }

    const oldPassword = await promptText('Enter the current password: ', true);
    const keystore = fs.readFileSync(keystoreFile, 'utf-8');
    let wallet: Wallet | HDNodeWallet;
    try {
        wallet = await Wallet.fromEncryptedJson(keystore, oldPassword);
    } catch (error) {
        logger.error('Invalid current password.');
        return;
    }

    const newPassword = await promptText('Enter the new password: ', true);
    const newKeystore = await wallet.encrypt(newPassword);

    fs.writeFileSync(keystoreFile, newKeystore);
    logger.log(`Keystore password has been updated and saved to ${keystoreFile}`);
}

async function showPublicKey() {
    if (!fs.existsSync(keystoreFile)) {
        logger.error('Keystore file does not exist.');
        return;
    }

    const keystore = fs.readFileSync(keystoreFile, 'utf-8');
    const wallet = JSON.parse(keystore);
    logger.log(`Public Key: 0x${wallet.address}`);
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
