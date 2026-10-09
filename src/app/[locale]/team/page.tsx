import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContentPage } from '@/components/content-page';
import { copy, isLocale } from '@/lib/i18n';
import { getPublicTeam } from '@/lib/public-content';

export default async function TeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const result = await getPublicTeam();
  return <ContentPage locale={locale} copy={copy[locale]} title={locale === 'sk' ? 'Tím' : 'Tým'} description={locale === 'sk' ? 'Ľudia, ktorí budujú komunitu NinjaMelon.' : 'Lidé, kteří budují komunitu NinjaMelon.'} state={result.state}>
    {result.state === 'ok' ? <div className="people-grid">{result.data.map((member) => {
      const name = member.display_name || member.minecraft_username || (locale === 'sk' ? 'Hráč' : 'Hráč');
      const role = locale === 'sk' ? member.role_sk : member.role_cs;
      const bio = locale === 'sk' ? member.bio_sk : member.bio_cs;
      return <article className="people-card" key={member.user_id}><span className="person-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span><p className="section-kicker">{role}</p><h2>{name}</h2>{bio ? <p>{bio}</p> : null}<Link href={`/${locale}/players/${member.user_id}`} className="text-link"><span>{locale === 'sk' ? 'Verejný profil' : 'Veřejný profil'}</span><span aria-hidden="true">→</span></Link></article>;
    })}</div> : undefined}
  </ContentPage>;
}
