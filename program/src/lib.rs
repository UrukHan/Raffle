use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed}, //, invoke_signed
    program_error::ProgramError,
    pubkey::Pubkey,
    sysvar::{clock::Clock, Sysvar},
    program_pack::Pack,
};
use spl_token::{
    self,
    state::{ Account },
    instruction::transfer,
};

const USDC_MINT_ADDRESS: &str = "5Bz7gmFHSsbSEUMzYJ7SogqhfKnnrFAAmBrs3i3pZULw";
const SEED: &[u8] = b"lottery";

entrypoint!(process_instruction);
#[no_mangle]
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    _instruction_data: &[u8],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    let user_account = next_account_info(account_info_iter)?;
    let user_usdc_account = next_account_info(account_info_iter)?;
    let lottery_usdc_account = next_account_info(account_info_iter)?;
    let usdc_mint = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let clock_sysvar = next_account_info(account_info_iter)?;
    let lottery_account_info = next_account_info(account_info_iter)?;

    let usdc_mint_str = usdc_mint.key.to_string();
    if usdc_mint_str != USDC_MINT_ADDRESS {
        msg!("Учетная запись USDC должна иметь правильный mint адрес");
        return Err(ProgramError::InvalidAccountData);
    }
    let clock = Clock::from_account_info(clock_sysvar)?;
    let transfer_ix = transfer(
        &spl_token::id(),
        &user_usdc_account.key,
        &lottery_usdc_account.key,
        &user_account.key,
        &[&user_account.key],
        100 * 10u64.pow(9),
    )?;
    invoke(
        &transfer_ix,
        &[
            token_program.clone(),
            user_usdc_account.clone(),
            lottery_usdc_account.clone(),
            user_account.clone(),
        ],
    )?;
    let random_number = (clock.unix_timestamp as u64) % 100;
    if random_number < 40 {
        let (lottery_pda_address, bump_seed) = Pubkey::find_program_address(
            &[&SEED, &lottery_account_info.key.to_bytes()],
            program_id,
        );
        let transfer_ix = transfer(
            &spl_token::id(),
            &lottery_usdc_account.key,
            &user_usdc_account.key,
            &lottery_account_info.key,
            &[&lottery_account_info.key],
            180 * 10u64.pow(9),
        )?;
        invoke_signed(
            &transfer_ix,
            &[
                token_program.clone(),
                lottery_usdc_account.clone(),
                user_usdc_account.clone(),
                lottery_account_info.clone(),
            ],
            &[&[SEED, &[bump_seed]]],
        )?;

    }
    Ok(())
}
