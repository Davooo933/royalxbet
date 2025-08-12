import React, { createContext, useContext, useMemo, useState } from 'react';

type Dict = Record<string, string>;

const en: Dict = {
  'app.brand': 'RoyalX Casino',
  'nav.login': 'Login',
  'nav.register': 'Register',
  'nav.dashboard': 'Dashboard',
  'nav.games': 'Games',
  'nav.logout': 'Logout',
  'nav.lang': 'Language',

  'login.title': 'Login',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.submit': 'Sign in',
  'login.toRegister': 'Create account',

  'register.title': 'Create account',
  'register.email': 'Email',
  'register.password': 'Password',
  'register.submit': 'Sign up',
  'register.toLogin': 'Sign in',

  'dashboard.balance': 'Balance',
  'dashboard.depositTitle': 'Deposit (USDT TRC-20)',
  'dashboard.address': 'Address',
  'dashboard.note': 'Send only USDT on TRON (TRC-20). Credits occur after network confirmation.',
  'dashboard.play': 'Play',
  'dashboard.openLobby': 'Open Games Lobby',

  'games.title': 'Games Lobby',
  'games.balance': 'Balance',
  'games.themed': 'Themed Slots',
  'games.result': 'Result: payout',

  'generic.usdt': 'USDT',
  'generic.spin': 'Spin',
  'generic.play': 'Play',
  'generic.deal': 'Deal',
  'generic.rows': 'Rows',
  'generic.bin': 'Bin',
  'generic.segment': 'Segment',
  'generic.cashoutX': 'Cashout x',
  'generic.risk': 'Risk',
  'generic.high': 'High',
  'generic.low': 'Low',

  'coinflip.heads': 'Heads',
  'coinflip.tails': 'Tails',
  'dice.under': 'Under',
  'dice.roll': 'Roll',
  'plinko.drop': 'Drop',
  'roulette.red': 'Red',
  'roulette.black': 'Black',
  'roulette.even': 'Even',
  'roulette.odd': 'Odd',
  'double.red': 'Red',
  'double.black': 'Black',
  'double.green': 'Green',
  'wheel.spin': 'Spin'
};

const ru: Dict = {
  'app.brand': 'RoyalX Казино',
  'nav.login': 'Войти',
  'nav.register': 'Регистрация',
  'nav.dashboard': 'Главная',
  'nav.games': 'Игры',
  'nav.logout': 'Выйти',
  'nav.lang': 'Язык',

  'login.title': 'Вход',
  'login.email': 'Эл. почта',
  'login.password': 'Пароль',
  'login.submit': 'Войти',
  'login.toRegister': 'Создать аккаунт',

  'register.title': 'Создание аккаунта',
  'register.email': 'Эл. почта',
  'register.password': 'Пароль',
  'register.submit': 'Зарегистрироваться',
  'register.toLogin': 'Войти',

  'dashboard.balance': 'Баланс',
  'dashboard.depositTitle': 'Депозит (USDT TRC-20)',
  'dashboard.address': 'Адрес',
  'dashboard.note': 'Отправляйте только USDT в сети TRON (TRC-20). Зачисление после подтверждений сети.',
  'dashboard.play': 'Играть',
  'dashboard.openLobby': 'Открыть лобби игр',

  'games.title': 'Лобби игр',
  'games.balance': 'Баланс',
  'games.themed': 'Слоты с темами',
  'games.result': 'Результат: выплата',

  'generic.usdt': 'USDT',
  'generic.spin': 'Крутить',
  'generic.play': 'Играть',
  'generic.deal': 'Раздать',
  'generic.rows': 'Рядов',
  'generic.bin': 'Ячейка',
  'generic.segment': 'Сегмент',
  'generic.cashoutX': 'Вывод при x',
  'generic.risk': 'Риск',
  'generic.high': 'Больше',
  'generic.low': 'Меньше',

  'coinflip.heads': 'Орел',
  'coinflip.tails': 'Решка',
  'dice.under': 'Меньше',
  'dice.roll': 'Бросить',
  'plinko.drop': 'Бросить',
  'roulette.red': 'Красное',
  'roulette.black': 'Черное',
  'roulette.even': 'Четное',
  'roulette.odd': 'Нечетное',
  'double.red': 'Красное',
  'double.black': 'Черное',
  'double.green': 'Зеленое',
  'wheel.spin': 'Крутить'
};

const dicts: Record<string, Dict> = { en, ru };

type Ctx = { locale: 'en' | 'ru'; setLocale: (l: 'en'|'ru') => void; t: (k: string) => string };
const I18nContext = createContext<Ctx>({ locale: 'en', setLocale: ()=>{}, t: (k)=>k });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<'en'|'ru'>(() => (localStorage.getItem('locale') as 'en'|'ru') || 'en');
  const value = useMemo(() => ({
    locale,
    setLocale: (l: 'en'|'ru') => { localStorage.setItem('locale', l); (window as any).__setLocale?.(l); },
    t: (k: string) => (dicts[locale] && dicts[locale][k]) || dicts.en[k] || k
  }), [locale]);

  // allow external set to trigger rerender
  (window as any).__setLocale = (l: 'en'|'ru') => { setLocale(l); };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() { return useContext(I18nContext); }