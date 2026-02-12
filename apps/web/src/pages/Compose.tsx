import { useTranslation } from 'react-i18next';
export default function Compose() {
  const { t } = useTranslation();
  return <div className="space-y-6"><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('compose.title')}</h1><div className="card"><div className="card-body"><p className="text-gray-500">{t('compose.comingSoon')}</p></div></div></div>;
}
