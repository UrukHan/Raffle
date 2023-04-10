#![feature(proc_macro_hygiene, decl_macro)]

#[macro_use]
extern crate rocket;

use rocket::{State};
use rocket::http::Method;
use solana_client::rpc_client::RpcClient;
use rocket::request::Form;
use rocket_contrib::json::{Json};
use rocket_cors::{AllowedHeaders, AllowedOrigins, CorsOptions};
use arrayref::{array_ref};
use serde::{Serialize, Deserialize};
use solana_sdk::{
    pubkey::Pubkey,
    signature::{read_keypair_file},
    transaction::Transaction,
};
use solana_sdk::signature::Signer;
use spl_associated_token_account;
use spl_associated_token_account::get_associated_token_address;
use std::fs::File;
use std::io::prelude::*;
use std::str::FromStr;

#[derive(Deserialize)]
struct ConfigFile {
    custom_token_address: String,
    solana_network_url: String,
    token_symbol: String,
    token_decimals: u8,
}

#[derive(FromForm)]
struct WalletAddress {
    address: String,
}

fn read_config_file(file_name: &str) -> ConfigFile {
    let mut file = File::open(file_name).expect("Не удалось открыть файл конфигурации");
    let mut contents = String::new();
    file.read_to_string(&mut contents).expect("Не удалось прочитать файл конфигурации");

    serde_json::from_str(&contents).expect("Не удалось десериализовать конфигурацию")
}

#[derive(Debug, Serialize)]
struct TokenAccountInfo {
    amount: f64,
    mint: String,
    owner: String,
    token_symbol: String,
}

impl Default for TokenAccountInfo {
    fn default() -> Self {
        TokenAccountInfo {
            mint: Pubkey::default().to_string(),
            owner: Pubkey::default().to_string(),
            amount: 0.0,
            token_symbol: String::new(),
        }
    }
}

struct Config {
    custom_token_address: String,
    solana_network_url: String,
    token_symbol: String,
    token_decimals: u8,
}

impl Config {
    fn new(custom_token_address: String, solana_network_url: String, token_symbol: String, token_decimals: u8) -> Self {
        Config {
            custom_token_address,
            solana_network_url,
            token_symbol,
            token_decimals,
        }
    }
}

#[derive(Serialize, Deserialize)]
struct TokenAddresses {
    program_address: String,
    user_wallet_address: String,
    token_mint_address: String,
}

#[post("/get_token_accounts", data = "<token_addresses>")]
fn get_token_accounts(config: State<Config>, token_addresses: Json<TokenAddresses>) -> Json<Vec<String>> {
    let program_address = Pubkey::from_str(&token_addresses.program_address).unwrap();
    let user_wallet_address = Pubkey::from_str(&token_addresses.user_wallet_address).unwrap();
    let usdc_mint_address = Pubkey::from_str(&token_addresses.token_mint_address).unwrap();

    let payer_keypair = match read_keypair_file("deployer.json") {
        Ok(keypair) => keypair,
        Err(e) => {
            eprintln!("Failed to read keypair file: {}", e);
            std::process::exit(1);
        }
    };

    let rpc_client = RpcClient::new(config.solana_network_url.clone());

    //spl_token::native_mint::id()
    let user_usdc_account = get_associated_token_address(&user_wallet_address, &usdc_mint_address);
    let lottery_usdc_account = get_associated_token_address(&program_address, &usdc_mint_address);

    let accounts_to_create = [
        (&user_usdc_account, &usdc_mint_address),
        (&lottery_usdc_account, &usdc_mint_address),
    ];


    for (associated_token_address, mint_address) in accounts_to_create.iter() {
        if let Err(_) = rpc_client.get_account(associated_token_address) {
            let create_account_instruction = spl_associated_token_account::instruction::create_associated_token_account(
                &payer_keypair.pubkey(),
                &user_wallet_address,
                &mint_address,
                &spl_token::id(),
            );

            let recent_blockhash = rpc_client.get_latest_blockhash().unwrap();
            let transaction = Transaction::new_signed_with_payer(
                &[create_account_instruction],
                Some(&payer_keypair.pubkey()),
                &[&payer_keypair],
                recent_blockhash,
            );
            if let Err(e) = rpc_client.send_and_confirm_transaction_with_spinner(&transaction) {
                eprintln!("Failed to send and confirm transaction: {}", e);
            } else {
                println!("Transaction sent and confirmed successfully");
            }
            //let _result = rpc_client.send_and_confirm_transaction_with_spinner(&transaction).unwrap();
        }
    }

    let token_accounts = vec![
        user_usdc_account.to_string(),
        lottery_usdc_account.to_string(),
    ];

    Json(token_accounts)
}

#[get("/balance?<address..>")]
fn balance(config: State<Config>, address: Form<WalletAddress>) -> String {
    let rpc_client = RpcClient::new(config.solana_network_url.clone());
    let token_mint_address = Pubkey::from_str(&config.custom_token_address).expect("Ошибка: неверный адрес монеты токена");

    let wallet_address = Pubkey::from_str(&address.address).expect("Ошибка: неверный адрес кошелька");

    let associated_token_address = get_associated_token_address(&wallet_address, &token_mint_address);
    let account_info = rpc_client.get_account(&associated_token_address).expect("Failed to get account info");
    let account_data = &account_info.data;

    let mint = Pubkey::new_from_array(*array_ref![account_data, 0, 32]);
    let owner = Pubkey::new_from_array(*array_ref![account_data, 32, 32]);
    let amount = u64::from_le_bytes(*array_ref![account_data, 64, 8]);

    let token_account_info = TokenAccountInfo {
        mint: mint.to_string(),
        owner: owner.to_string(),
        amount: (amount as f64) / (10u64.pow(config.token_decimals.into()) as f64),
        token_symbol: config.token_symbol.clone(),
        ..TokenAccountInfo::default()
    };

    serde_json::to_string(&token_account_info).unwrap()
}

fn main() {
    let config_data = read_config_file("config.json");
    let custom_token_address = config_data.custom_token_address;
    let solana_network_url = config_data.solana_network_url;
    let token_symbol = config_data.token_symbol;
    let token_decimals = config_data.token_decimals;

    let allowed_origins = AllowedOrigins::some_exact(&["http://localhost:3000"]);

    let cors = CorsOptions::default()
        .allowed_origins(allowed_origins)
        .allowed_methods(
            vec![Method::Get, Method::Post]
                .into_iter()
                .map(From::from)
                .collect(),
        )
        .allowed_headers(AllowedHeaders::All)
        .allow_credentials(true)
        .to_cors()
        .expect("Unable to create CORS.");

    rocket::ignite()
        .mount("/", routes![balance, get_token_accounts])
        .manage(Config::new(
            custom_token_address,
            solana_network_url,
            token_symbol,
            token_decimals,
        ))
        .attach(cors)
        .launch();
}
