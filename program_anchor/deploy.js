const { Keypair } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const programAuthorityKeypair = new Keypair();

const { Connection, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

connection
  .requestAirdrop(programAuthorityKeypair.publicKey, LAMPORTS_PER_SOL * 1)
  .then((signature) => {
    console.log(`Airdrop successful with signature ${signature}`);
    connection
      .confirmTransaction(signature)
      .then(() => {
        console.log("Load deployer keys")
        const programAuthorityKeyfileName = `deployer.json`;
        const programAuthorityKeypairBytes = JSON.parse(fs.readFileSync(programAuthorityKeyfileName));
        const programAuthorityKeypair = Keypair.fromSecretKey(new Uint8Array(programAuthorityKeypairBytes));
        const programAuthorityKeypairFile = path.resolve(`${__dirname}/deployer.json`);
        console.log("write")
        fs.writeFileSync(
          programAuthorityKeypairFile,
          `[${Buffer.from(programAuthorityKeypair.secretKey.toString())}]`
        );
        console.log("Load program keys")
        const programKeyfileName = `target/deploy/anchor-keypair.json`;
        const programKeypairBytes = JSON.parse(fs.readFileSync(programKeyfileName));
        const programKeypair = Keypair.fromSecretKey(new Uint8Array(programKeypairBytes));
        const programKeypairFile = path.resolve(`${__dirname}/target/deploy/anchor-keypair.json`);
        let programId = programKeypair.publicKey.toString();

        let method = ["deploy"];

        spawnSync("anchor", [
          ...method,
          "--provider.cluster",
          "devnet",
          "--provider.wallet",
          `${programAuthorityKeypairFile}`,
        ], { stdio: "inherit" });
      })
      .catch((err) => {
        console.error(`Error confirming transaction: ${err}`);
      });
  })
  .catch((err) => {
    console.error(`Error requesting airdrop: ${err}`);
  });
