
import React, { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PhantomWalletName } from "@solana/wallet-adapter-phantom";
import { Transaction, TransactionInstruction, PublicKey, Keypair, sendAndConfirmTransaction, LAMPORTS_PER_SOL  } from "@solana/web3.js";
import { Buffer } from "buffer";

function PhantomWallet() {
    const { publicKey, select, connect, disconnect, connected, signTransaction } = useWallet();
    const { connection } = useConnection();
    const [balanceSOL, setBalanceSOL] = useState(null);
    const [balanceUSD, setBalanceUSD] = useState(null);
    const [usdMint, setUsdMint] = useState(null);
    const [usdSymbol, setUsdSymbol] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    const PROGRAM_KEYPAIR = [224,104,60,186,60,143,232,226,249,236,144,252,136,246,210,192,195,247,61,105,52,110,68,252,64,143,60,48,189,125,71,160,194,110,161,60,106,18,51,19,80,7,215,103,251,125,175,232,91,182,67,134,251,113,149,87,25,159,207,172,73,67,60,68];
    const PROGRAM_ADDRESS ="E5ywEAH5e8jPMj2RoWpXvy1mi6FVBeDe7m847mDRoXXH";
    const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

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
        try {
            await select(PhantomWalletName);
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
        if (!isConnected || !usdMint ) {
            console.log("Кошелек не подключен или отсутствуют ключи mint и associativeMint");
            return;
        }

        try {

            const usdc_mint = new PublicKey(usdMint);
            const clock_sysvar = new PublicKey("SysvarC1ock11111111111111111111111111111111");
            const accountsSPL = await getProgramUSDCAddresses(PROGRAM_ADDRESS, publicKey.toBase58(), usdMint);
            const user_usdc_pubKey = new PublicKey(accountsSPL.userUSDCAddress)
            const lottery_usdc_pubKey = new PublicKey(accountsSPL.lotteryUSDCAddress)

            const secretKey = Uint8Array.from(PROGRAM_KEYPAIR);
            const keypair = Keypair.fromSecretKey(secretKey);
            const programPubKey = new PublicKey(keypair.publicKey);

            const SEED = "lottery";
            const seedBytes = new TextEncoder().encode(SEED);
            const [lotteryPdaAddress, _] = await PublicKey.findProgramAddress([seedBytes, programPubKey.toBytes()], programPubKey);

            const lottery_account_info = lotteryPdaAddress;

            const instructionData = Buffer.alloc(0);

            const keys = [
                { pubkey: publicKey, isSigner: true, isWritable: false },
                { pubkey: user_usdc_pubKey, isSigner: false, isWritable: true },
                { pubkey: lottery_usdc_pubKey, isSigner: false, isWritable: true },
                { pubkey: usdc_mint, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: clock_sysvar, isSigner: false, isWritable: false },
                { pubkey: lottery_account_info, isSigner: false, isWritable: true },
            ];

            const instruction = new TransactionInstruction({
                keys,
                programId: new PublicKey(PROGRAM_ADDRESS),
                data: instructionData,
            });

            const { blockhash } = await connection.getLatestBlockhash();
            const transaction = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey }).add(instruction);


            await signTransaction(transaction);
            console.log()
            const txHash = await sendAndConfirmTransaction(connection, transaction, [publicKey]);
            console.log(`Transaction hash: ${txHash}`);
        } catch (error) {
            console.error("Error while sending lottery transaction:", error);
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