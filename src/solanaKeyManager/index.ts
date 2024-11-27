import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as readline from 'readline';
import * as crypto from 'crypto';
import bs58 from 'bs58';
import logger from '../logger';

const keystoreFile = 'keystore/solana.json';
const algorithm = 'aes-256-cbc';
const ivLength = 16; // For AES, this is always 16

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

function encrypt(text: string, password: string): string {
    const iv = crypto.randomBytes(ivLength);
    const key = crypto.scryptSync(password, 'salt', 32);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string, password: string): string {
    const [ivHex, encryptedText] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(password, 'salt', 32);
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

async function generateKeystore() {
    if (fs.existsSync(keystoreFile)) {
        const replace = await promptPassword('Keystore already exists. Do you want to replace it? (yes/no): ');
        if (replace.toLowerCase() !== 'yes') {
            const keystore = JSON.parse(fs.readFileSync(keystoreFile, 'utf-8'));
            const password = await promptPassword('Enter the password to decrypt the keystore: ');
            const secretKey = decrypt(keystore.secretKey, password);
            const publicKey = keystore.publicKey;
            logger.log(`Public Key: ${publicKey}, Secret Key: ${secretKey}`);
            return;
        }
    }

    const password = await promptPassword('Enter a password to encrypt the keystore: ');
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
