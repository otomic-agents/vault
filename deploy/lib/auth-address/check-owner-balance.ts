#!/usr/bin/env node

// SPDX-License-Identifier: Apache-2.0
//
// Owner Balance Checker for Vault-Deploy
// Checks owner's Optimism balance before publishing addresses

import fs from 'fs';
import { Web3 } from 'web3';
import { WalletUtils } from './wallet-utils';
// @ts-ignore - toml package doesn't have TypeScript types
import toml from 'toml';

// Balance result interface
interface BalanceResult {
  address: string;
  balanceETH: string;
  balanceWei: string;
}

// Configuration interfaces
interface KeysConfig {
  owner?: {
    mnemonic?: string;
  };
  [key: string]: any;
}

interface ConfigConfig {
  rpc?: {
    optimism?: string;
  };
  [key: string]: any;
}

/**
 * Check owner's Optimism balance
 */
async function checkOwnerOptimismBalance(): Promise<BalanceResult> {
    try {
        console.log('🔍 Checking owner balance on Optimism chain...\n');

        // Read configuration files
        console.log('📖 Reading configuration files...');
        let keysConfig: KeysConfig, configConfig: ConfigConfig;

        try {
            const keysContent = fs.readFileSync('keys.toml', 'utf8');
            keysConfig = toml.parse(keysContent);
        } catch (error) {
            console.error('❌ Failed to read keys.toml:', error instanceof Error ? error.message : String(error));
            throw error;
        }

        try {
            const configContent = fs.readFileSync('config.toml', 'utf8');
            configConfig = toml.parse(configContent);
        } catch (error) {
            console.error('❌ Failed to read config.toml:', error instanceof Error ? error.message : String(error));
            throw error;
        }

        // Extract configuration
        const mnemonic = keysConfig.owner?.mnemonic;
        const optimismRpc = configConfig.rpc?.optimism;

        if (!mnemonic) {
            console.error('❌ Owner mnemonic not found in keys.toml');
            throw new Error('Owner mnemonic not found');
        }

        if (!optimismRpc) {
            console.error('❌ Optimism RPC not found in config.toml');
            throw new Error('Optimism RPC not found');
        }

        console.log(`✅ Configuration loaded successfully`);
        console.log(`   RPC: ${optimismRpc}`);

        // Initialize WalletUtils and derive owner address
        console.log('\n🔑 Deriving owner address from mnemonic...');
        const walletUtils = new WalletUtils();
        
        try {
            const { address } = await walletUtils.deriveAddressFromMnemonic(mnemonic);
            console.log(`✅ Owner address derived: ${address}`);

            // Query Optimism balance
            console.log('\n💰 Querying Optimism balance...');
            const web3 = new Web3(optimismRpc);

            const balanceWei = await web3.eth.getBalance(address);
            const balanceETH = web3.utils.fromWei(balanceWei, 'ether');

            console.log('\n📊 Balance Check Results:');
            console.log('================================');
            console.log(`Owner Optimism Address: ${address}`);
            console.log(`Balance: ${balanceETH} ETH`);
            console.log(`Balance (Wei): ${balanceWei}`);

            return { address, balanceETH, balanceWei: balanceWei.toString() };

        } finally {
            // Clean up resources regardless of success or failure
            walletUtils.cleanup();
        }

    } catch (error) {
        console.error('\n❌ Balance check failed:', error instanceof Error ? error.message : String(error));
        console.log('⚠️  Continuing with publish operation despite balance check failure...\n');
        throw error;
    }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
    try {
        await checkOwnerOptimismBalance();
        console.log('\n✅ Balance check completed successfully');
    } catch (error) {
        // Don't exit with error code to avoid blocking publish operation
        console.log('\n⚠️  Balance check completed with warnings');
        process.exit(0); // Always exit with success to not block flow
    }
}

// Run main function if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('\n💥 Unexpected error:', error);
        process.exit(0); // Still exit with success to not block flow
    });
}

export { checkOwnerOptimismBalance };
export type { BalanceResult, KeysConfig, ConfigConfig };