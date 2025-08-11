// Minimal TRON USDT poller and withdrawal broadcaster
// NOTE: This is a simplified implementation using TronGrid API via tronweb. In production, use a full node or reliable event indexing.
// @ts-ignore
import TronWeb from 'tronweb';
import { PrismaClient, TxStatus, TxType } from '@prisma/client';
const prisma = new PrismaClient();
const tronWeb = new TronWeb({
    fullHost: process.env.TRON_NETWORK === 'shasta' ? 'https://api.shasta.trongrid.io' : 'https://api.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' },
    privateKey: process.env.TRON_PRIVATE_KEY || ''
});
const USDT_CONTRACT = process.env.TRON_USDT_CONTRACT || 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj';
const CONFIRMATIONS = Number(process.env.TRON_CONFIRMATIONS || 12);
const POLL_INTERVAL_MS = Number(process.env.TRON_POLL_INTERVAL_MS || 30000);
async function getCurrentBlock() {
    const now = await tronWeb.trx.getCurrentBlock();
    return now.block_header.raw_data.number;
}
async function creditDepositIfNew(txHash, toAddress, amountUSDT) {
    // find user by depositAddress
    const user = await prisma.user.findFirst({ where: { depositAddress: toAddress } });
    if (!user)
        return;
    const cents = Math.floor(amountUSDT * 100);
    // idempotency via unique txHash
    const existing = await prisma.transaction.findFirst({ where: { txHash } });
    if (existing)
        return;
    await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { balanceCents: { increment: cents } } }),
        prisma.transaction.create({ data: { userId: user.id, amountCents: cents, currency: 'USDT', type: TxType.DEPOSIT, status: TxStatus.CONFIRMED, txHash, address: toAddress } })
    ]);
}
export async function runTronDepositPoller() {
    try {
        let lastBlock = Number(process.env.TRON_START_BLOCK || 0) || (await getCurrentBlock() - 1000);
        setInterval(async () => {
            try {
                const tip = await getCurrentBlock();
                const toScanUntil = tip - CONFIRMATIONS;
                if (toScanUntil <= lastBlock)
                    return;
                // USDT TRC-20 transfer event signature: Transfer(address,address,uint256)
                // TronGrid provides event queries
                const url = `${tronWeb.fullNode.host}/v1/contracts/${USDT_CONTRACT}/events?event_name=Transfer&from_block=${lastBlock + 1}&to_block=${toScanUntil}`;
                const res = await fetch(url, { headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' } });
                if (!res.ok)
                    return;
                const body = await res.json();
                const events = body?.data || [];
                for (const ev of events) {
                    const toHex = ev.result?.to;
                    const to = toHex ? tronWeb.address.fromHex(toHex) : '';
                    const val = ev.result?.value ? Number(ev.result.value) : 0; // USDT has 6 decimals on TRON
                    const amountUSDT = val / 1000000;
                    const txHash = ev.transaction_id;
                    if (to && amountUSDT > 0) {
                        await creditDepositIfNew(txHash, to, amountUSDT);
                    }
                }
                lastBlock = toScanUntil;
            }
            catch (e) {
                // swallow and continue
            }
        }, POLL_INTERVAL_MS);
    }
    catch (e) {
        // swallow
    }
}
export async function runTronWithdrawalBroadcaster() {
    setInterval(async () => {
        try {
            // pick pending withdrawals
            const pendings = await prisma.transaction.findMany({ where: { type: TxType.WITHDRAWAL, status: TxStatus.PENDING }, take: 10, orderBy: { createdAt: 'asc' } });
            if (pendings.length === 0)
                return;
            const contract = await tronWeb.contract().at(USDT_CONTRACT);
            for (const tx of pendings) {
                if (!tx.address)
                    continue;
                const amount = Math.abs(tx.amountCents) / 100 * 1000000; // to 6 decimals
                try {
                    const result = await contract.transfer(tx.address, amount).send();
                    await prisma.transaction.update({ where: { id: tx.id }, data: { status: TxStatus.CONFIRMED, txHash: String(result) } });
                }
                catch (e) {
                    await prisma.transaction.update({ where: { id: tx.id }, data: { status: TxStatus.FAILED, memo: 'broadcast_failed' } });
                }
            }
        }
        catch (e) {
            // swallow
        }
    }, POLL_INTERVAL_MS);
}
