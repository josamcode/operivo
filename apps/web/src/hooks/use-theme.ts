import { useCallback, useEffect, useState } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';

const read = (): ThemePref => {
  try {
    return (localStorage.getItem('opervio-theme') as ThemePref) || 'light';
  } catch {
    return 'system';
  }
};

const apply = (pref: ThemePref) => {
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  return dark;
};

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(read);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    setDark(apply(pref));
    try {
      localStorage.setItem('opervio-theme', pref);
    } catch {
      /* private mode */
    }
    if (pref !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setDark(apply('system'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);

  const toggle = useCallback(() => setPref(dark ? 'light' : 'dark'), [dark]);
  return { pref, setPref, dark, toggle };
}

/** Re-renders when the html.dark class flips (charts need resolved colors). */
export function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}
