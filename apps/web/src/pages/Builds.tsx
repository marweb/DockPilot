import { useTranslation } from 'react-i18next';
export default function Builds() {
  const { t } = useTranslation();
  return <div className="space-y-6"><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('builds.title')}</h1><div className="card"><div className="card-body"><p className="text-gray-500">{t('builds.comingSoon')}</p></div></div></div>;
}
