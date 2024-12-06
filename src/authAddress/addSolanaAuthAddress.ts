import { Keypair, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';
import axios from 'axios';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { decodeUTF8 } from 'tweetnacl-util';
import { promptText, getCurTimeStampInSecond, generateUUID } from '../utils';
import logger from '../logger';

const Action = {
    Add: 0,
    Remove: 1,
};

async function addEvmAuthAddress() {
    try {
        // Prompt user for domain
        const terminusName = await promptText(
            'The script will add the [solanaWallets] tag to a terminus domain, Enter the terminus domain: ',
        );

        // Prompt user for domain owner private key
        const domainOwnerPrivateKey = await promptText('Enter the private key for the terminus domainn owner: ');

        // Create a wallet instance
        let domainOwner: ethers.Wallet;
        try {
            domainOwner = new ethers.Wallet(domainOwnerPrivateKey);
        } catch {
            throw new Error('Invalid private key');
        }

        // Prompt user for wallet address
        const vaultAddressStr = await promptText(
            `Enter the Solana wallet address ata the vault address (bs58 format) to be added: `,
        );

        // Validate wallet address
        let vaultAddress: PublicKey;
        try {
            vaultAddress = new PublicKey(vaultAddressStr);
        } catch {
            throw new Error('Invalid Solana wallet address');
        }

        const chainId = 10;
        const rootTaggerAddr = '0x7e7961aB771cA942CE4DB6e79579e016a33Dc95B';

        const domain = {
            name: 'Terminus DID Root Tagger',
            version: '1',
            chainId: chainId,
            verifyingContract: rootTaggerAddr,
        };

        const types = {
            SolanaAuthAddressReq: [
                { name: 'addr', type: 'bytes32' },
                { name: 'domain', type: 'string' },
                { name: 'signAt', type: 'uint256' },
                { name: 'action', type: 'uint8' },
            ],
        };

        const value = {
            addr: '0x' + vaultAddress.toBuffer().toString('hex'),
            domain: terminusName,
            signAt: getCurTimeStampInSecond(),
            action: Action.Add,
        };

        logger.info(`Signing data: ${JSON.stringify(value)}`);

        const domainOwnerSig = await domainOwner.signTypedData(domain, types, value);
        logger.info(`Domain owner signature: ${domainOwnerSig}`);

        const solanaMsg =
            'prove ownership of Solana wallet ' + vaultAddress.toBase58() + ' for Terminus DID ' + value.domain;
        logger.info(`Vault solana signing msg: ${solanaMsg}`);

        // Prompt user for vault url
        const vaultUrl = await promptText('Enter the vault URL (e.g., http://127.0.0.1/lp/501/signEIP712): ');

        // Send POST request to vault URL to get signature from vault wallet
        const response = await axios.post(vaultUrl, {
            message: solanaMsg,
        });

        const vaultSig = '0x' + response.data.signature;
        const vaultAddressRet = response.data.publicKey as string;
        if (vaultAddressRet.toLocaleLowerCase() !== vaultAddress.toBase58().toLocaleLowerCase()) {
            throw new Error('The vault address returned by the vault is not the same as the address provided');
        }
        logger.info(`Vault Signature: ${vaultSig} from vault ${vaultAddress}`);

        // Send to DID-HTTP server
        const didHttpUrl = await promptText(
            'Enter the did-http URL to submit request (e.g., http://127.0.0.1/sendTx/normal): ',
        );
        const uuid = generateUUID();
        logger.info(`DID-HTTP uuid: ${uuid}, it can be used to query the status of the request`);
        // Send POST request to DID-HTTP server
        const didResponse = await axios.post(didHttpUrl, {
            uuid,
            calls: [
                {
                    target: 'tag2',
                    method: 'updateSolanaWallet',
                    args: {
                        solanaAuthAddressReq: value,
                        sigFromDomainOwnerPrivKey: domainOwnerSig,
                        sigFromAddressPrivKey: vaultSig,
                    },
                },
            ],
        });

        logger.info(`DID-HTTP Response: ${JSON.stringify(didResponse.data)}`);
    } catch (error) {
        logger.error(`Error adding wallet address: ${(error as Error).message}`);
    }
}

addEvmAuthAddress().catch((error) => {
    logger.error(`Unexpected error: ${error.message}`);
});
