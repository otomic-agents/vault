import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { HDNodeWallet, Wallet } from 'ethers';
import logger from '../logger';
import { config } from '../config';

const keystoreFile = path.join(config.keystorePath, 'evm.json');
export default class Server {
    private hostname: string = '127.0.0.1';
    private port: number;
    private server: http.Server;
    private wallet: Wallet | HDNodeWallet | undefined = undefined;

    constructor() {
        this.port = config.evmVaultPort;
        this.server = http.createServer(this.requestListener.bind(this));
    }

    private async loadPrivateKey() {
        const keystore = fs.readFileSync(keystoreFile, 'utf-8');
        logger.log(`Loaded keystore from ${keystoreFile}`);
        logger.log(keystore);
        logger.log(config.evmWalletPassword);
        const wallet = await Wallet.fromEncryptedJson(keystore, config.evmWalletPassword);
        this.wallet = wallet;
        logger.log(`Loaded wallet with address: ${this.wallet.address}`);
    }

    private requestListener(req: http.IncomingMessage, res: http.ServerResponse): void {
        if (req.url === '/signTx' && req.method === 'POST') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Hello, World!\n');
            logger.log('Responded with Hello, World!');
        } else if (req.url === '/signEIP712' && req.method === 'POST') {
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
        });
    }
}
