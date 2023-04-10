import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { clusterApiUrl } from "@solana/web3.js";
import React from "react";
import PhantomWallet from "./PhantomWallet";

const network = WalletAdapterNetwork.Devnet;
const endpoint = clusterApiUrl(network);

function App() {
    const wallet = useMemo(() => new PhantomWalletAdapter(), []);

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={[wallet]} >
                <PhantomWallet />
            </WalletProvider>
        </ConnectionProvider>
    );
}

export default App;
