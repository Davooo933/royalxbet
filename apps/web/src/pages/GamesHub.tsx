import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

type Game = { key: string; name: string; isEnabled: boolean };

export function GamesHub({ token, path }: { token: string; path: string }) {
  const [games, setGames] = useState<Game[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [message, setMessage] = useState('');

  useEffect(() => { (async () => {
    const [g, me] = await Promise.all([
      api(token).get('/games/list'),
      api(token).get('/auth/me')
    ]);
    setGames(g.data);
    setBalance(me.data.balanceCents);
  })(); }, [token]);

  async function bet(gameKey: string, wager: number, selection: any) {
    setMessage('');
    const clientSeed = Math.random().toString(36).slice(2);
    const { data } = await api(token).post('/games/bet', { gameKey, wagerCents: Math.round(wager*100), selection, clientSeed });
    setMessage(`Result: payout ${(data.payoutCents/100).toFixed(2)} USDT`);
    const me = await api(token).get('/auth/me');
    setBalance(me.data.balanceCents);
  }

  const grouped = useMemo(() => {
    const themeds = games.filter(g=>g.key.startsWith('SLOTS_'));
    const core = games.filter(g=>!g.key.startsWith('SLOTS_'));
    return { core, themeds };
  }, [games]);

  return (
    <div className="grid">
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Games Lobby</h2>
          <div className="badge">Balance {(balance/100).toFixed(2)} USDT</div>
        </div>
        {message && <div style={{ marginTop: 8 }}>{message}</div>}
      </div>

      {grouped.core.map(g => (
        <GameTile key={g.key} game={g} onBet={bet} />
      ))}

      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <h3>Themed Slots</h3>
      </div>
      {grouped.themeds.map(g => (
        <GameTile key={g.key} game={g} onBet={bet} isSlots />
      ))}
    </div>
  );
}

function GameTile({ game, onBet, isSlots }: { game: Game; onBet: (k:string,w:number,s:any)=>void; isSlots?: boolean }) {
  const [wager, setWager] = useState(1);
  const [selection, setSelection] = useState<any>({});

  function Control() {
    switch (game.key) {
      case 'COINFLIP': return (
        <div className="row"><button className="btn" onClick={()=>onBet(game.key, wager, { side: 'HEADS' })}>Heads</button><button className="btn" onClick={()=>onBet(game.key, wager, { side: 'TAILS' })}>Tails</button></div>
      );
      case 'DICE': return (
        <div className="row">
          <span className="label">Under</span>
          <input className="input" type="number" min={2} max={98} value={selection.under ?? 50} onChange={e=>setSelection({ under: Number(e.target.value) })} style={{ maxWidth: 120 }} />
          <button className="btn" onClick={()=>onBet(game.key, wager, selection)}>Roll</button>
        </div>
      );
      case 'CRASH': return (
        <div className="row"><span className="label">Cashout x</span><input className="input" type="number" step="0.1" value={selection.cashout ?? 1.5} onChange={e=>setSelection({ cashout: Number(e.target.value) })} style={{ maxWidth: 120 }} /><button className="btn" onClick={()=>onBet(game.key, wager, selection)}>Start</button></div>
      );
      case 'PLINKO': return (
        <div className="row"><span className="label">Rows</span><input className="input" type="number" min={8} max={16} value={selection.rows ?? 12} onChange={e=>setSelection({ rows: Number(e.target.value) })} style={{ maxWidth: 120 }} /><button className="btn" onClick={()=>onBet(game.key, wager, selection)}>Drop</button></div>
      );
      case 'ROULETTE': return (
        <div className="row">
          <button className="btn" onClick={()=>onBet(game.key, wager, { type: 'RED' })}>Red</button>
          <button className="btn" onClick={()=>onBet(game.key, wager, { type: 'BLACK' })}>Black</button>
          <button className="btn" onClick={()=>onBet(game.key, wager, { type: 'EVEN' })}>Even</button>
          <button className="btn" onClick={()=>onBet(game.key, wager, { type: 'ODD' })}>Odd</button>
        </div>
      );
      case 'SLOTS':
      default:
        if (isSlots || game.key.startsWith('SLOTS')) {
          return <button className="btn" onClick={()=>onBet(game.key, wager, {})}>Spin</button>;
        }
        if (game.key === 'BLACKJACK') return (
          <div className="row"><span className="label">Risk</span><input className="input" type="number" min={0} max={9} value={selection.risk ?? 3} onChange={e=>setSelection({ risk: Number(e.target.value) })} style={{ maxWidth: 120 }} /><button className="btn" onClick={()=>onBet(game.key, wager, selection)}>Deal</button></div>
        );
        if (game.key === 'DOUBLE') return (
          <div className="row"><button className="btn" onClick={()=>onBet(game.key, wager, { color: 'RED' })}>Red</button><button className="btn" onClick={()=>onBet(game.key, wager, { color: 'BLACK' })}>Black</button><button className="btn" onClick={()=>onBet(game.key, wager, { color: 'GREEN' })}>Green</button></div>
        );
        if (game.key === 'HILO') return (
          <div className="row"><button className="btn" onClick={()=>onBet(game.key, wager, { pick: 'HIGH' })}>High</button><button className="btn" onClick={()=>onBet(game.key, wager, { pick: 'LOW' })}>Low</button></div>
        );
        if (game.key === 'BINS') return (
          <div className="row"><span className="label">Bin</span><input className="input" type="number" min={0} max={9} value={selection.bin ?? 0} onChange={e=>setSelection({ bin: Number(e.target.value) })} style={{ maxWidth: 120 }} /><button className="btn" onClick={()=>onBet(game.key, wager, selection)}>Play</button></div>
        );
        if (game.key === 'WHEEL') return (
          <div className="row"><span className="label">Segment</span><input className="input" type="number" min={0} max={6} value={selection.segment ?? 0} onChange={e=>setSelection({ segment: Number(e.target.value) })} style={{ maxWidth: 120 }} /><button className="btn" onClick={()=>onBet(game.key, wager, selection)}>Spin</button></div>
        );
        return <button className="btn" onClick={()=>onBet(game.key, wager, selection)}>Play</button>;
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700 }}>{game.name}</div>
          <div className="badge" style={{ marginTop: 4 }}>{game.key}</div>
        </div>
        <div className="row">
          <input className="input" style={{ maxWidth: 120 }} type="number" min={0.1} step={0.1} value={wager} onChange={e=>setWager(Number(e.target.value))} />
          <span className="label">USDT</span>
        </div>
      </div>
      <div style={{ marginTop: 8 }}><Control /></div>
    </div>
  );
}