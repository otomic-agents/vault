#!/usr/bin/env node

// SPDX-License-Identifier: Apache-2.0
//
// Wallet Utils for Vault-Deploy
// Provides unified EVM address derivation functionality

// Dependencies
import { initWasm } from '@trustwallet/wallet-core';
import { Web3 } from 'web3';

// Wallet info interface
interface WalletInfo {
  address: string;
  privateKeyHex: string;
}

/**
 * WalletUtils class - Unified wallet address derivation tool
 */
class WalletUtils {
    private WalletCore: any;
    private initialized: boolean;

    constructor() {
        this.WalletCore = null;
        this.initialized = false;
    }

    /**
     * Initialize WalletCore
     */
    async init(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            console.log('🚀 Initializing WalletCore...');
            this.WalletCore = await initWasm();
            this.initialized = true;
            console.log('✅ WalletCore initialized successfully');
        } catch (error) {
            console.error('❌ WalletCore initialization failed:', error instanceof Error ? error.message : String(error));
            throw new Error(`WalletCore initialization failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Derive Ethereum address from mnemonic
     * Reference user-provided getEthereumInfo function
     * @param mnemonic - Mnemonic phrase
     * @returns Address and private key
     */
    async deriveAddressFromMnemonic(mnemonic: string): Promise<WalletInfo> {
        if (!this.initialized) {
            await this.init();
        }

        if (!mnemonic || typeof mnemonic !== 'string') {
            throw new Error('Invalid mnemonic');
        }

        try {
            const { HDWallet, CoinType, AnyAddress } = this.WalletCore;

            // 1. Create HD wallet instance from mnemonic
            const wallet = HDWallet.createWithMnemonic(mnemonic, '');

            // 2. Derive Ethereum private key (using standard derivation path m/44'/60'/0'/0/0)
            const privateKey = wallet.getKeyForCoin(CoinType.ethereum);

            // 3. Get public key from private key
            const publicKey = privateKey.getPublicKeySecp256k1(false);

            // 4. Derive Ethereum address from public key
            const address = AnyAddress.createWithPublicKey(publicKey, CoinType.ethereum).description();

            // 5. Get raw bytes of private key and convert to standard hex format
            const privateKeyBytes = privateKey.data();
            const privateKeyHex = '0x' + Buffer.from(privateKeyBytes).toString('hex');

            // 6. Release WASM memory to prevent memory leaks
            wallet.delete();
            privateKey.delete();
            publicKey.delete();

            return { address, privateKeyHex };
        } catch (error) {
            console.error(`❌ Failed to derive address from mnemonic:`, error instanceof Error ? error.message : String(error));
            throw new Error(`Failed to derive address from mnemonic: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Derive EVM address from private key
     * @param privateKey - Private key
     * @returns Address
     */
    deriveAddressFromPrivateKey(privateKey: string): string {
        if (!privateKey || typeof privateKey !== 'string') {
            throw new Error('Invalid private key');
        }

        try {
            // EVM chain address derivation
            const web3 = new Web3();
            const account = web3.eth.accounts.privateKeyToAccount(privateKey);
            return account.address;
        } catch (error) {
            console.error(`❌ Failed to derive address from private key:`, error instanceof Error ? error.message : String(error));
            throw new Error(`Failed to derive address from private key: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Smart address derivation - automatically detect input type
     * @param input - mnemonic or private key
     * @returns Address
     */
    async deriveAddress(input: string): Promise<string> {
        if (!input) {
            throw new Error('Input cannot be empty');
        }

        // Detect if it's a mnemonic (word count >= 12)
        const words = input.trim().split(/\s+/);
        if (words.length >= 12) {
            // Process as mnemonic
            const result = await this.deriveAddressFromMnemonic(input);
            return result.address;
        } else {
            // Process as private key
            return this.deriveAddressFromPrivateKey(input);
        }
    }

    /**
     * Clean up resources
     */
    cleanup(): void {
        this.WalletCore = null;
        this.initialized = false;
    }
}

// ES Module export
export { WalletUtils };
export type { WalletInfo };