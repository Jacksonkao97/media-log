import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, List, Mail, Section } from "@/components/LegalPage";
import { tmdbKey } from "@/lib/discover/tmdb";

export const metadata: Metadata = { title: "服务条款 · MediaLog" };

const LINK = "text-primary underline underline-offset-2 hover:no-underline";
const TMDB_NOTICE =
  "This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.";

export default function Terms() {
  // TMDB (and its required notice) only while 电影 is on (shownFeeds).
  const tmdb = tmdbKey() !== null;
  return (
    <LegalPage
      title="服务条款"
      enTitle="Terms of Service"
      zh={
        <>
          <Section title="这是什么">
            <p>
              MediaLog
              是一个个人维护的、免费的非商业网站，用来记录动画、漫画和电影。使用本网站即表示你同意以下条款。
            </p>
          </Section>

          <Section title="你的数据">
            <List>
              <li>
                你的片单属于你。它保存在你的浏览器里；登录 Google
                后，也保存在你自己的 Google Drive 中。
              </li>
              <li>
                请定期用「导出备份」保存一份副本：清除浏览器数据会删除本机的片单，没有登录同步的话就无法找回。
              </li>
              <li>
                我们如何处理数据，见
                <Link href="/privacy" className={LINK}>
                  隐私政策
                </Link>
                。
              </li>
            </List>
          </Section>

          <Section title="合理使用">
            <p>
              请不要滥用本网站，例如自动大量发送请求、试图破坏或绕过它的安全措施，或者用它做违法的事。
            </p>
          </Section>

          <Section title="第三方内容与商标">
            <List>
              <li>
                {`「发现」里的作品资料和图片来自 ${tmdb ? "AniList 和 TMDB" : "AniList"}，版权归各自的权利人所有。`}
                {tmdb && TMDB_NOTICE}
              </li>
              <li>
                {`Google 和 Google Drive 是 Google LLC 的商标。MediaLog 与 ${tmdb ? "Google、AniList、TMDB" : "Google、AniList"} 都没有关联，也没有得到它们的认可。`}
              </li>
            </List>
          </Section>

          <Section title="按现状提供">
            <p>
              本网站免费、按「现状」提供：不保证一直可用、没有错误，也不保证数据不会丢失。功能可能随时更改或停止。
            </p>
          </Section>

          <Section title="责任限制">
            <p>
              在法律允许的最大范围内，对因使用或无法使用本网站造成的任何损失（包括数据丢失），我们不承担责任。
            </p>
          </Section>

          <Section title="变更">
            <p>
              条款如有变更，会更新本页和上面的生效日期。变更后继续使用本网站，即表示你接受新的条款。
            </p>
          </Section>

          <Section title="联系">
            <p>
              有任何问题，请写信到 <Mail />。
            </p>
          </Section>
        </>
      }
      en={
        <>
          <Section title="What this is">
            <p>
              MediaLog is a free, non-commercial website run by one person for
              keeping track of anime, manga and movies. By using it you agree to
              these terms.
            </p>
          </Section>

          <Section title="Your data">
            <List>
              <li>
                Your list is yours. It is stored in your browser and, if you
                sign in with Google, in your own Google Drive.
              </li>
              <li>
                Export a backup regularly: clearing your browser data deletes
                the list on that device, and without sync it cannot be
                recovered.
              </li>
              <li>
                How data is handled is described in the{" "}
                <Link href="/privacy" className={LINK}>
                  Privacy Policy
                </Link>
                .
              </li>
            </List>
          </Section>

          <Section title="Acceptable use">
            <p>
              Don&apos;t abuse the site: no automated bulk requests, no attempts
              to break or get around its security, and no unlawful use.
            </p>
          </Section>

          <Section title="Third-party content and trademarks">
            <List>
              <li>
                Work details and images in 发现 (Discover) come from{" "}
                {tmdb ? "AniList and TMDB" : "AniList"} and belong to their
                respective owners.{tmdb && ` ${TMDB_NOTICE}`}
              </li>
              <li>
                Google and Google Drive are trademarks of Google LLC. MediaLog
                is not affiliated with or endorsed by{" "}
                {tmdb ? "Google, AniList or TMDB" : "Google or AniList"}.
              </li>
            </List>
          </Section>

          <Section title="Provided as is">
            <p>
              The site is free and provided &quot;as is&quot;, with no guarantee
              that it will always be available, free of errors, or that data
              won&apos;t be lost. Features may change or end at any time.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              To the fullest extent the law allows, we are not liable for any
              loss, including loss of data, arising from using or being unable
              to use the site.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              If these terms change, this page and the effective date above will
              be updated. Continuing to use the site after a change means you
              accept the new terms.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions? Email <Mail />.
            </p>
          </Section>
        </>
      }
    />
  );
}
