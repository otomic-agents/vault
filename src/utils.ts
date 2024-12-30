import * as readline from 'readline';
import * as crypto from 'crypto';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import ip from 'ip';
import logger from './logger';

export async function promptTextNoDefault(promptText: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question(promptText, (input) => {
            rl.close();
            return resolve(input);
        });
    });
}

export async function promptText(promptText: string, defaultInput: string = ''): Promise<string> {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question(`${promptText} (default: ${defaultInput}): `, (input) => {
            rl.close();
            return resolve(input.trim() === '' ? defaultInput : input);
        });
    });
}

export function resolveKeystorePath(userInputPath: string): string {
    const projectRoot = process.cwd();
    if (userInputPath.startsWith('~')) {
        userInputPath = path.join(os.homedir(), userInputPath.slice(1));
    }
    return path.resolve(projectRoot, userInputPath);
}

const algorithm = 'aes-256-cbc';
const ivLength = 16; // For AES, this is always 16
export function encrypt(text: string, password: string): string {
    const iv = crypto.randomBytes(ivLength);
    const key = crypto.scryptSync(password, 'salt', 32);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(text: string, password: string): string {
    const [ivHex, encryptedText] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(password, 'salt', 32);
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

export function getNormalizedIp(req: http.IncomingMessage): string | undefined {
    logger.info(`${JSON.stringify(req.headers, null, 2)}, ${req.socket.remoteAddress}`);

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress;
    if (!clientIp) return undefined;
    return ip.isV6Format(clientIp) ? ip.toString(ip.toBuffer(clientIp).slice(-4)) : clientIp;
}

export function getCurTimeStampInSecond(): number {
    return Math.floor(Date.now() / 1000);
}

export function generateUUID(): string {
    return '0x' + crypto.randomBytes(16).toString('hex');
}

export function bigIntReplacer(key: string, value: any) {
    return typeof value === 'bigint' ? value.toString() : value;
}
