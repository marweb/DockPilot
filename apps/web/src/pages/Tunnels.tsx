import { useTranslation } from 'react-i18next';
export default function Tunnels() {
  const { t } = useTranslation();
  return <div className="space-y-6"><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('tunnels.title')}</h1><div className="card"><div className="card-body"><p className="text-gray-500">{t('tunnels.comingSoon')}</p></div></div></div>;
}
