#!/usr/bin/env node

import fs from "fs";
import path from "path";
// @ts-ignore - toml package doesn't have TypeScript types
import toml from "toml";
import { Web3 } from "web3";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

interface ChainConfig {
  [key: string]: string | number | boolean;
}

interface TomlConfig {
  [section: string]: ChainConfig;
}

class KeyGenerator {
  generateEvmPrivateKey(): string {
    const web3 = new Web3();
    const account = web3.eth.accounts.create();
    return account.privateKey;
  }

  generateSolanaPrivateKey(): string {
    const keypair = Keypair.generate();
    return bs58.encode(keypair.secretKey);
  }

  isEmptyPrivateKey(key: string | undefined | null): boolean {
    if (!key) return true;
    if (typeof key !== "string") return true;
    const trimmedKey = key.trim();
    return trimmedKey === "" || trimmedKey === "0x";
  }

  async readToml(filePath: string): Promise<TomlConfig> {
    try {
      const content = await fs.promises.readFile(filePath, "utf8");
      return toml.parse(content) as TomlConfig;
    } catch (error) {
      console.error(
        `❌ Failed to read ${filePath}:`,
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  }

  /**
   * Update TOML file while preserving comments and formatting
   */
  async updateTomlPreserveComments(
    filePath: string,
    updates: Map<string, Map<string, string>>
  ): Promise<void> {
    const content = await fs.promises.readFile(filePath, "utf8");
    const lines = content.split("\n");
    
    let currentSection = "";
    const updatedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Detect section header
      if (trimmedLine.startsWith("[") && trimmedLine.endsWith("]")) {
        currentSection = trimmedLine.slice(1, -1);
        updatedLines.push(line);
        continue;
      }

      // Check if this is a key-value line
      if (trimmedLine.includes("=") && !trimmedLine.startsWith("#")) {
        const equalIndex = line.indexOf("=");
        const beforeEqual = line.substring(0, equalIndex).trim();
        const afterEqual = line.substring(equalIndex + 1).trim();

        // Check if we have an update for this section and key
        if (
          currentSection &&
          updates.has(currentSection) &&
          updates.get(currentSection)!.has(beforeEqual)
        ) {
          const newValue = updates.get(currentSection)!.get(beforeEqual)!;
          
          // Preserve indentation
          const leadingSpaces = line.match(/^(\s*)/)?.[1] || "";
          
          // Reconstruct the line with new value
          updatedLines.push(`${leadingSpaces}${beforeEqual} = "${newValue}"`);
          continue;
        }
      }

      // Keep all other lines unchanged (including comments)
      updatedLines.push(line);
    }

    await fs.promises.writeFile(filePath, updatedLines.join("\n"), "utf8");
  }

  maskPrivateKey(key: string): string {
    if (key.length < 16) {
      return key.substring(0, 6) + "...";
    }
    return `${key.substring(0, 10)}...${key.substring(key.length - 6)}`;
  }

  async generateMissingKeys(): Promise<number> {
    const keysFile = path.join(__dirname, "../..", "keys.toml");

    if (!fs.existsSync(keysFile)) {
      console.error("❌ keys.toml does not exist");
      process.exit(1);
    }

    // Read current configuration
    const config = await this.readToml(keysFile);

    let generatedCount = 0;
    const chains = Object.keys(config).filter(
      (key) => !["global", "owner"].includes(key)
    );

    // Store updates: section -> key -> new value
    const updates = new Map<string, Map<string, string>>();

    console.log("=== Generating Missing Private Keys ===\n");

    for (const chain of chains) {
      const chainData = config[chain];
      console.log(`Checking ${chain} chain...`);

      const privateKeyFields = Object.keys(chainData).filter((key) =>
        key.startsWith("private_key_")
      );

      if (privateKeyFields.length === 0) {
        console.log(`  No private key slots found for ${chain}`);
        console.log("");
        continue;
      }

      for (const keyField of privateKeyFields) {
        const currentValue = chainData[keyField];

        if (this.isEmptyPrivateKey(currentValue as string)) {
          console.log(`  Generating ${keyField}...`);

          let newKey: string;
          try {
            if (chain === "solana") {
              newKey = this.generateSolanaPrivateKey();
            } else {
              newKey = this.generateEvmPrivateKey();
            }

            // Store update
            if (!updates.has(chain)) {
              updates.set(chain, new Map());
            }
            updates.get(chain)!.set(keyField, newKey);

            console.log(`  ✅ Generated ${keyField}: ${this.maskPrivateKey(newKey)}`);
            generatedCount++;
          } catch (error) {
            console.error(
              `  ❌ Failed to generate ${keyField}:`,
              error instanceof Error ? error.message : String(error)
            );
          }
        } else {
          console.log(`  ✓ ${keyField} already configured`);
        }
      }

      console.log("");
    }

    // Write updates while preserving comments
    if (generatedCount > 0) {
      await this.updateTomlPreserveComments(keysFile, updates);
      console.log("=== Summary ===");
      console.log(`✅ Generated ${generatedCount} private key(s)`);
      console.log("\n⚠️  IMPORTANT: Please backup your keys.toml file securely!");
    } else {
      console.log("✅ All private keys are already configured. No generation needed.");
    }

    return generatedCount;
  }
}

async function main(): Promise<void> {
  try {
    const generator = new KeyGenerator();
    const count = await generator.generateMissingKeys();
    process.exit(count >= 0 ? 0 : 1);
  } catch (error) {
    console.error(
      "❌ Failed to generate keys:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main();
