import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { HeartHandshake, FileText, FolderOpen, Newspaper, UserRound, ArrowUpRight } from 'lucide-react';
import './style.css';

const tabs = [
  { label: 'Сборы', icon: HeartHandshake },
  { label: 'Отчет', icon: FileText },
  { label: 'Проекты', icon: FolderOpen },
  { label: 'Новости', icon: Newspaper },
  { label: 'Профиль', icon: UserRound },
] as const;

const links = {
  site: 'https://fond-bit-dobru.ru/',
  pdf: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
} as const;

function App() {
  const [selected, setSelected] = useState(0);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  async function openExternal(key: keyof typeof links) {
    setError('');
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await AppLauncher.openUrl({ url: links[key] });
        if (!result.completed) throw new Error('not-opened');
      } else {
        window.open(links[key], '_blank', 'noopener,noreferrer');
      }
    } catch {
      setError('Не удалось открыть ссылку. Попробуйте еще раз.');
    }
  }

  return <div className="app">
    <header><img src="/brand.jpg" alt="Фонд Быть Добру" width="144" height="72" /><span>Проверочная сборка</span></header>
    <main key={selected}>
      <h1>{tabs[selected].label}</h1>
      {selected === 4 ? <section>
        <h2>Гость</h2>
        <label htmlFor="email">Электронная почта</label>
        <input id="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.ru" />
        <p className="muted">Вход пока не подключен.</p>
      </section> : <section className="empty">
        {selected === 1 ? <><FileText size={32} /><h2>Документы фонда</h2><button onClick={() => void openExternal('pdf')}>Проверочный PDF <ArrowUpRight size={18} /></button></> : <><HeartHandshake size={32} /><h2>Публикаций пока нет</h2></>}
      </section>}
      <section className="links"><h2>Быть Добру</h2><button onClick={() => void openExternal('site')}>Сайт фонда <ArrowUpRight size={18} /></button></section>
      {error && <p role="alert">{error}</p>}
    </main>
    <nav aria-label="Основные разделы">{tabs.map(({ label, icon: Icon }, index) => <button key={label} aria-current={selected === index ? 'page' : undefined} onClick={() => { setSelected(index); setError(''); }}><Icon size={23} /><span>{label}</span></button>)}</nav>
  </div>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
