import { HDNodeWallet, Wallet } from 'ethers';
import * as fs from 'fs';
import logger from '../logger';
import { promptText, promptTextNoDefault, resolveKeystorePath } from '../utils';

async function generateKeystore() {
    // const userInputKeystoreFile = await promptText(
    //     'Enter the full path for the keystore file (e.g., /path/to/keystore.json)',
    //     './evm-keystore.json'
    // );
    // const keystoreFile = resolveKeystorePath(userInputKeystoreFile);
    const keystoreFile = './evm-keystore.json';

    if (fs.existsSync(keystoreFile)) {
        const replace = await promptText('Keystore already exists. Do you want to replace it? (yes/no)', 'no');
        if (replace.toLowerCase() !== 'yes') return;
    }

    const password = await promptTextNoDefault('Enter a password to encrypt the keystore:');
    const wallet = Wallet.createRandom();
    const keystore = await wallet.encrypt(password);

    fs.writeFileSync(keystoreFile, keystore);
    logger.log(`Public Key: ${wallet.address}`);
    logger.log(`Keystore saved to ${keystoreFile}`);
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
    const keystore = fs.readFileSync(keystoreFile, 'utf-8');
    let wallet: Wallet | HDNodeWallet;
    try {
        wallet = await Wallet.fromEncryptedJson(keystore, oldPassword);
    } catch (error) {
        logger.error('Invalid current password.');
        return;
    }

    const newPassword = await promptText('Enter the new password: ');
    const newKeystore = await wallet.encrypt(newPassword);

    fs.writeFileSync(keystoreFile, newKeystore);
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

    const keystore = fs.readFileSync(keystoreFile, 'utf-8');
    const wallet = JSON.parse(keystore);
    logger.log(`Public Key: 0x${wallet.address}`);
}

async function showPrivateKey() {
    const userInputKeystoreFile = await promptText(
        'Enter the full path for the keystore file (e.g., /path/to/keystore.json): ',
    );
    const keystoreFile = resolveKeystorePath(userInputKeystoreFile);

    if (!fs.existsSync(keystoreFile)) {
        logger.error('Keystore file does not exist.');
        return;
    }

    const password = await promptText('Enter the password to decrypt the keystore: ');
    const keystore = fs.readFileSync(keystoreFile, 'utf-8');

    try {
        const wallet = await Wallet.fromEncryptedJson(keystore, password);
        logger.log(`Public Key: ${wallet.address}`);
        logger.log(`Private Key: ${wallet.privateKey}`);
        logger.log(`WARNING: Please keep your private key secure and do not share it with anyone!`);
    } catch (error) {
        logger.error('Invalid password or corrupted keystore file.');
        return;
    }
}

async function main() {
    const action = await promptText('Choose an action: generate/modify/show/show-private: ', 'generate');

    if (action.toLowerCase() === 'generate') {
        await generateKeystore();
    } else if (action.toLowerCase() === 'modify') {
        await modifyKeystorePassword();
    } else if (action.toLowerCase() === 'show') {
        await showPublicKey();
    } else if (action.toLowerCase() === 'show-private') {
        await showPrivateKey();
    } else {
        logger.error('Invalid action.');
    }
}

main().catch((error) => {
    logger.error(`Error: ${JSON.stringify(error, null, 2)}`);
});
