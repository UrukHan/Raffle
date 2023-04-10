use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount};
use solana_program::entrypoint::ProgramResult;

declare_id!("8qVLNjbke5YVRnna5ZeWVRfCLV5gh4HiuKnuHRdhNXmf");
const SEED: &[u8] = b"lottery";

#[program]
mod raffle_program {
    use super::*;

    pub fn transfer(mut ctx: Context<Transfer>) -> ProgramResult {
        my_lottery_program::transfer(&mut ctx)
    }
}

#[derive(Accounts)]
pub struct Transfer<'info> {
    #[account(init, payer = user_account, space = 8+8)]
    pub user_account: AccountInfo<'info>,
    #[account(mut)]
    pub user_usdc_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub lottery_usdc_account: Account<'info, TokenAccount>,
    #[account(address = token::ID)]
    pub token_program: AccountInfo<'info>,
    #[account(mut)]
    pub lottery_account_info: AccountInfo<'info>,
    #[account(signer)]
    pub lottery_authority: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}


pub mod my_lottery_program {
    use super::*;

    pub fn transfer(ctx: &mut Context<Transfer>) -> ProgramResult {
        let user_account = &ctx.accounts.user_account;
        let user_usdc_account = &mut ctx.accounts.user_usdc_account;
        let lottery_usdc_account = &mut ctx.accounts.lottery_usdc_account;
        let lottery_account_info = &mut ctx.accounts.lottery_account_info;

        let token_program = ctx.accounts.token_program.clone();
        let cpi_accounts = token::Transfer {
            from: user_usdc_account.to_account_info(),
            to: lottery_usdc_account.to_account_info(),
            authority: user_account.to_account_info(),
        };
        let cpi_program = token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token::transfer(cpi_ctx, 100 * 10u64.pow(9))?;

        let random_number = (Clock::get()?.unix_timestamp as u64) % 100;
        if random_number < 40 {
            let (_lottery_pda_address, bump_seed) = Pubkey::find_program_address(
                &[&SEED, &lottery_account_info.key().to_bytes()],
                ctx.program_id,
            );

            let cpi_accounts = token::Transfer {
                from: lottery_usdc_account.to_account_info(),
                to: user_usdc_account.to_account_info(),
                authority: ctx.accounts.lottery_authority.to_account_info(),
            };
            let cpi_program = token_program.to_account_info();

            let seeds = &[
                SEED,
                &lottery_account_info.key().to_bytes(),
                &[bump_seed],
            ];

            let signer_seeds = &[&seeds[..]];
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
            token::transfer(cpi_ctx, 180 * 10u64.pow(9))?;
        }

        Ok(())
    }
}
