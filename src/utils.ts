import * as readline from 'readline';
import * as crypto from 'crypto';
import * as path from 'path';
import * as os from 'os';

export async function promptText(promptText: string, hideInput: boolean = false): Promise<string> {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        if (hideInput) {
            process.stdout.write(promptText);
            process.stdin.setRawMode(true);
            process.stdin.resume();
            let input = '';
            process.stdin.on('data', (charBuf) => {
                let char = charBuf.toString();
                switch (char) {
                    case '\n':
                    case '\r':
                    case '\u0004':
                        process.stdin.setRawMode(false);
                        process.stdin.pause();
                        rl.close();
                        process.stdout.write('\n');
                        return resolve(input);
                    case '\u0003':
                        process.stdin.setRawMode(false);
                        process.stdin.pause();
                        rl.close();
                        return reject(new Error('User aborted'));
                    case '\u007f': // Handle backspace
                        if (input.length > 0) {
                            input = input.slice(0, -1);
                            process.stdout.clearLine(0);
                            process.stdout.cursorTo(0);
                            process.stdout.write(promptText + '*'.repeat(input.length));
                        }
                        break;
                    default:
                        input += char;
                        process.stdout.clearLine(0);
                        process.stdout.cursorTo(0);
                        process.stdout.write(promptText + '*'.repeat(input.length));
                }
            });
        } else {
            rl.question(promptText, (input) => {
                rl.close();
                return resolve(input);
            });
        }
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
