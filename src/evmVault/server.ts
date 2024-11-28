import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { HDNodeWallet, Wallet, TypedDataDomain, TypedDataField, Transaction } from 'ethers';
import logger from '../logger';
import { config } from './config';

const keystoreFile = path.join(config.keystoreFolder, config.vaultName);

interface EIP712Data {
    domain: TypedDataDomain;
    types: Record<string, TypedDataField[]>;
    signData: Record<string, any>;
}
export default class Server {
    private hostname: string = '127.0.0.1';
    private port: number;
    private server: http.Server;
    private wallet: Wallet | HDNodeWallet | undefined = undefined;

    constructor() {
        this.port = config.port;
        this.server = http.createServer(this.requestListener.bind(this));
    }

    private async loadPrivateKey() {
        const keystore = fs.readFileSync(keystoreFile, 'utf-8');
        logger.log(`Loaded keystore from ${keystoreFile}`);
        const wallet = await Wallet.fromEncryptedJson(keystore, config.vaultPassword);
        this.wallet = wallet;
        logger.log(`Loaded wallet with address: ${this.wallet.address}`);
    }

    private async signTransaction(serializedTx: string): Promise<{ signedTx: string; publicKey: string }> {
        await this.loadPrivateKey();
        if (!this.wallet) {
            throw new Error('Wallet is not loaded');
        }

        let tx = Transaction.from(serializedTx);

        const unsignedTx = {
            to: tx.to,
            data: tx.data,
            value: tx.value,
            gasPrice: tx.gasPrice,
            gasLimit: tx.gasLimit,
            chainId: tx.chainId,
            nonce: tx.nonce,
        };

        //TODO: Implement the security check

        const signedTx = await this.wallet.signTransaction(unsignedTx);
        logger.log(`Signed transaction: ${signedTx}`);
        const ret = {
            signedTx: signedTx,
            publicKey: this.wallet.address,
        };
        this.wallet = undefined;
        return ret;
    }

    private async signEIP712(data: EIP712Data): Promise<{ signedData: string; publicKey: string }> {
        await this.loadPrivateKey();
        if (!this.wallet) {
            throw new Error('Wallet is not loaded');
        }

        //TODO: Implement the security check

        const signedData = await this.wallet.signTypedData(data.domain, data.types, data.signData);
        logger.log(`Signed EIP-712 data: ${signedData}`);
        const ret = {
            signedData: signedData,
            publicKey: this.wallet.address,
        };
        this.wallet = undefined;
        return ret;
    }

    private requestListener(req: http.IncomingMessage, res: http.ServerResponse): void {
        logger.log(`Received request: ${req.method} ${req.url}`);

        if (req.url === '/signTx' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    if (!data || !data.txData) {
                        throw new Error('Invalid tx data');
                    }
                    const ret = await this.signTransaction(data.txData);
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(
                        JSON.stringify({
                            message: 'Message tx signed successfully',
                            signedTx: ret.signedTx,
                            publicKey: ret.publicKey,
                        }),
                    );
                } catch (error) {
                    if ((error as Error).message === 'Invalid tx data') {
                        res.statusCode = 400;
                        res.setHeader('Content-Type', 'text/plain');
                        res.end('Bad Request');
                    } else {
                        logger.error(`Error signing EIP-712 data: ${JSON.stringify(error, null, 2)}`);
                        res.statusCode = 500;
                        res.setHeader('Content-Type', 'text/plain');
                        res.end('Internal Server Error');
                    }
                }
            });
        } else if (req.url === '/signEIP712' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    if (!data || !data.domain || !data.types || !data.signData) {
                        throw new Error('Invalid EIP-712 data');
                    }
                    const ret = await this.signEIP712(data);
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(
                        JSON.stringify({
                            message: 'Message signed successfully',
                            signature: ret.signedData,
                            publicKey: ret.publicKey,
                        }),
                    );
                } catch (error) {
                    if ((error as Error).message === 'Invalid EIP-712 data') {
                        res.statusCode = 400;
                        res.setHeader('Content-Type', 'text/plain');
                        res.end('Bad Request');
                    } else {
                        logger.error(`Error signing EIP-712 data: ${JSON.stringify(error, null, 2)}`);
                        res.statusCode = 500;
                        res.setHeader('Content-Type', 'text/plain');
                        res.end('Internal Server Error');
                    }
                }
            });
        } else {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Not Found\n');
            logger.error('Responded with Not Found');
        }
    }

    public async start(): Promise<void> {
        await this.loadPrivateKey();
        this.server.listen(this.port, this.hostname, () => {
            logger.log(`Server running at http://${this.hostname}:${this.port}/`);
            // reset wallet after server is started, then load it again when sign request comes
            this.wallet = undefined;
        });
    }
}
