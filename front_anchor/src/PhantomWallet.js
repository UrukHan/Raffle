import idl from "./idl.json";
import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PhantomWalletName } from "@solana/wallet-adapter-phantom";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

import { Program, AnchorProvider, web3 } from "@project-serum/anchor";
const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const PROGRAM_ADDRESS ="7RbVL8uj4SWXAEqoV4oYLvUcKgZWgxENkGDQ5rqkCg64";
const programId = new web3.PublicKey(PROGRAM_ADDRESS);
const PROGRAM_KEYPAIR = [224,104,60,186,60,143,232,226,249,236,144,252,136,246,210,192,195,247,61,105,52,110,68,252,64,143,60,48,189,125,71,160,194,110,161,60,106,18,51,19,80,7,215,103,251,125,175,232,91,182,67,134,251,113,149,87,25,159,207,172,73,67,60,68];

function PhantomWallet() {
    const wallet = useWallet();
    const { publicKey, select, connect, disconnect, connected } = wallet;
    const [balanceSOL, setBalanceSOL] = useState(null);
    const [balanceUSD, setBalanceUSD] = useState(null);
    const [usdMint, setUsdMint] = useState(null);
    const [usdSymbol, setUsdSymbol] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    const provider = new AnchorProvider(
        connection,
        wallet,
        AnchorProvider.defaultOptions()
    );
    const anchorProgram = new Program(idl, programId, provider);

    useEffect(() => {
        if (connected) {
            getBalance();
            setIsConnected(true);
        }
    }, [connected]);

    useEffect(() => {
        if (!connection || !publicKey) {
            return;
        }

        connection.getAccountInfo(publicKey).then((info) => {
            setBalanceSOL(info?.lamports);
        });
    }, [connection, publicKey]);

    async function getBalance() {
        try {
            const response = await fetch(
                `http://localhost:8000/balance?address=${publicKey.toBase58()}`
            );
            const data = await response.json();
            setBalanceUSD(data.amount);
            setUsdMint(data.mint);
            setUsdSymbol(data.token_symbol);
            console.log(data)
        } catch (err) {
            console.log(err);
        }
    }

    async function handleКRefresh() {
        try {
            const balance = await connection.getBalance(publicKey);
            setBalanceSOL(balance);
            await Promise.all([getBalance()]);
        } catch (error) {
            console.error(error);
        }
    }

    async function handleConnect() {
        try {            await select(PhantomWalletName);
            await connect();
            setIsConnected(true);
            setBalanceSOL(null);
            setBalanceUSD(null);
            setUsdMint(null);
            setUsdSymbol(null);
            const balance = await connection.getBalance(publicKey);
            setBalanceSOL(balance);
            await Promise.all([getBalance()]);
        } catch (error) {
            console.error(error);
        }
    }

    function handleDisconnect() {
        disconnect();
        setIsConnected(false);
        setBalanceSOL(null);
        setBalanceUSD(null);
        setUsdMint(null);
        setUsdSymbol(null);
    }

    async function getProgramUSDCAddresses(tokenProgramUSD, userWalletAddress, usdMint) {
        try {
            const data = {
                user_wallet_address: userWalletAddress,
                token_mint_address: usdMint,
                program_address: tokenProgramUSD,
            };
            const response = await fetch("http://localhost:8000/get_token_accounts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            const [userUSDCAddress, lotteryUSDCAddress] = result;
            return {
                userUSDCAddress,
                lotteryUSDCAddress
            };
        } catch (err) {
            console.log(err);
        }
    }

    async function sendLotteryTransaction() {
        if (!isConnected ) {
            console.log("Wallet dont connect");
            return;
        }

        try {

            const accountsSPL = await getProgramUSDCAddresses(PROGRAM_ADDRESS, publicKey.toBase58(), usdMint);
            const user_usdc_pubKey = new PublicKey(accountsSPL.userUSDCAddress)
            const lottery_usdc_pubKey = new PublicKey(accountsSPL.lotteryUSDCAddress)

            const secretKey = Uint8Array.from(PROGRAM_KEYPAIR);
            const keypair = Keypair.fromSecretKey(secretKey);
            const programPubKey = new PublicKey(keypair.publicKey);

            const SEED = "lottery";
            const seedBytes = new TextEncoder().encode(SEED);
            const [lotteryPdaAddress, _] = await PublicKey.findProgramAddress([seedBytes, programPubKey.toBytes()], programPubKey);

            await anchorProgram.rpc.transfer({
                accounts: {
                    userAccount: publicKey,
                    userUsdcAccount: user_usdc_pubKey,
                    lotteryUsdcAccount: lottery_usdc_pubKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    lotteryAccountInfo: lotteryPdaAddress,
                    lotteryAuthority: publicKey,
                },
                signers: [publicKey],
            });

            console.log("Transaction send!");
        } catch (error) {
            console.error("Transaction send error:", error);
        }
    }

    return (
        <>
            {!isConnected && (
                <button onClick={handleConnect}>Подключиться к Phantom</button>
            )}
            {isConnected && publicKey && (
                <>
                    <p>Адрес вашего кошелька: {publicKey.toBase58()}</p>
                    {balanceSOL !== null ? (
                        <p>Баланс SOL: {balanceSOL / LAMPORTS_PER_SOL} SOL</p>
                    ) : (
                        <p>Загрузка баланса SOL...</p>
                    )}
                    {balanceUSD !== null ? (
                        <>
                            <p>
                                Баланс {usdSymbol}: {balanceUSD} {usdSymbol}
                            </p>
                            <p>Адресс {usdSymbol}: {usdMint}</p>
                        </>
                    ) : (
                        <p>Загрузка баланса {usdSymbol}...</p>
                    )}
                    <button onClick={handleDisconnect}>Отключиться</button>
                    <button onClick={handleКRefresh}>Обновить баланс</button>
                    <button onClick={sendLotteryTransaction}>Играть в лотерею</button>
                </>
            )}
        </>
    );
}

export default PhantomWallet;


