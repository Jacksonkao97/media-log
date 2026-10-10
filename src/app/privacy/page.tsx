import type { Metadata } from "next";
import { Ext, LegalPage, List, Mail, Section } from "@/components/LegalPage";
import { tmdbKey } from "@/lib/discover/tmdb";
import { gaId } from "@/lib/analytics";

export const metadata: Metadata = { title: "隐私政策 · MediaLog" };

const GOOGLE_POLICY =
  "https://developers.google.com/terms/api-services-user-data-policy";
const PERMISSIONS = "https://myaccount.google.com/permissions";
const GA_PRIVACY = "https://policies.google.com/technologies/partner-sites";
const GA_OPTOUT = "https://tools.google.com/dlpage/gaoptout";

export default function Privacy() {
  // TMDB is only contacted while 电影 is on (shownFeeds).
  const sources = tmdbKey()
    ? ["AniList、TMDB", "AniList and TMDB"]
    : ["AniList", "AniList"];
  // Google Analytics is only loaded while NEXT_PUBLIC_GA_ID is set.
  const analytics = gaId() !== null;
  return (
    <LegalPage
      title="隐私政策"
      enTitle="Privacy Policy"
      zh={
        <>
          <p className="text-muted-foreground mt-6">
            MediaLog 是一个个人维护的动画 / 漫画 /
            电影追踪网站。这份政策说明它用到哪些数据、存在哪里，以及怎么删除。
          </p>

          <Section title="你的片单存在哪里">
            <List>
              <li>
                你记录的作品（名称、进度、状态、备注、链接等）保存在你自己浏览器的本地存储（IndexedDB）里。我们没有数据库，服务器上不保存任何人的片单。
              </li>
              <li>
                浏览器里还会存少量设置：上次登录的 Google
                账号的名称、邮箱和头像链接（让离线时也能显示是谁登录的，不含任何凭证），以及上次导出备份的时间。
              </li>
              <li>清除这个网站的浏览器数据，就会删除以上内容。</li>
            </List>
          </Section>

          <Section title="登录 Google 之后">
            <p>登录是可选的。登录时，MediaLog 会向 Google 请求：</p>
            <List>
              <li>
                <strong>基本资料</strong>
                （姓名、邮箱、头像）：显示是谁登录了，并把同步记录和这个账号对应起来。
              </li>
              <li>
                <strong>Google Drive 的 drive.file 权限</strong>：只能访问
                MediaLog 自己在你的 Drive 里创建的文件，看不到你 Drive
                里的其他任何文件。MediaLog 会在你的 Drive 里建一个 MediaLog
                文件夹，存放四个区域的 JSON
                文件和每天一份快照，用来在你的设备之间同步。
              </li>
            </List>
            <p>
              同步时由你的浏览器直接和 Google Drive
              通信。片单内容不经过我们的服务器，我们的服务器也从不读取你 Drive
              里的内容。
            </p>
          </Section>

          <Section title="登录凭证">
            <List>
              <li>
                Google 发给 MediaLog 的令牌保存在你浏览器里一个加密的 Cookie
                中，网页脚本读不到它（httpOnly）。服务器只在需要时用它向 Google
                换一个短期（约 1 小时）的访问令牌，交给你的浏览器去访问
                Drive；服务器不另外保存这些令牌。
              </li>
              <li>
                退出登录会删除这个 Cookie。你也可以随时在{" "}
                <Ext href={PERMISSIONS}>Google 账号的第三方应用页面</Ext>
                撤销 MediaLog 的访问权限。
              </li>
            </List>
          </Section>

          <Section title="Google 用户数据的使用限制">
            <p>
              MediaLog 对从 Google API 获得的信息的使用和转移，遵守{" "}
              <Ext href={GOOGLE_POLICY}>
                Google API Services User Data Policy
              </Ext>
              ，包括其中的 Limited
              Use（有限使用）要求。这些数据只用来为你提供登录和同步：不出售、不用于广告、不转给任何第三方，也不会被人查看。
            </p>
          </Section>

          <Section title="Cookie 与统计">
            {analytics ? (
              <>
                <p>
                  登录用到必需的 Cookie（会话、防止跨站请求伪造）。另外，网站用
                  Google Analytics 统计访问量，它会设置自己的 Cookie（_ga
                  开头），记录你看了哪些页面、浏览器和设备类型、大致地区（由 IP
                  地址推断）等，帮助我们了解网站的使用情况。
                </p>
                <List>
                  <li>
                    你的片单内容、Google 账号信息和 Drive 里的数据都不会发给
                    Google Analytics。
                  </li>
                  <li>没有广告，也不用这些数据做广告。</li>
                  <li>
                    不想被统计，可以用浏览器的跟踪保护或广告拦截，或者安装{" "}
                    <Ext href={GA_OPTOUT}>Google Analytics 停用插件</Ext>
                    。网站照常可用。Google 怎么处理这些数据，见{" "}
                    <Ext href={GA_PRIVACY}>Google 的说明</Ext>。
                  </li>
                </List>
              </>
            ) : (
              <p>
                只使用登录所必需的
                Cookie（会话、防止跨站请求伪造）。没有广告或统计用的
                Cookie，也没有任何第三方统计或广告脚本。
              </p>
            )}
          </Section>

          <Section title="第三方服务">
            <List>
              <li>
                Google：登录，以及同步到 Google Drive
                {analytics && "；Google Analytics 统计访问量（见上）"}。
              </li>
              <li>
                Vercel：网站托管。和所有网站一样，托管服务商会处理请求的技术信息（例如
                IP 地址、访问的网址和时间），用于运行和保护网站，见{" "}
                <Ext href="https://vercel.com/legal/privacy-policy">
                  Vercel 的隐私政策
                </Ext>
                。
              </li>
              <li>
                {sources[0]}
                ：「发现」里的资讯由我们的服务器向它们获取，不附带你的任何个人信息。作品封面由你的浏览器直接从它们的图片服务器加载，所以这些服务器会看到你的
                IP 地址。
              </li>
            </List>
          </Section>

          <Section title="儿童">
            <p>本网站不面向 13 岁以下的儿童。</p>
          </Section>

          <Section title="删除你的数据">
            <List>
              <li>本机的数据：在浏览器里清除这个网站的数据。</li>
              <li>Google Drive 里的数据：删除 Drive 中的 MediaLog 文件夹。</li>
              <li>
                访问权限：在{" "}
                <Ext href={PERMISSIONS}>Google 账号的第三方应用页面</Ext>
                撤销 MediaLog。
              </li>
            </List>
            <p>我们的服务器上没有你的个人数据，所以那里没有需要删除的东西。</p>
          </Section>

          <Section title="变更">
            <p>这份政策如有变更，会更新本页和上面的生效日期。</p>
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
          <p className="text-muted-foreground mt-6">
            MediaLog is a personally run tracker for anime, manga and movies.
            This policy explains what data it uses, where that data is kept, and
            how to delete it.
          </p>

          <Section title="Where your list is kept">
            <List>
              <li>
                The works you record (titles, progress, status, notes, links)
                are stored in your own browser&apos;s local storage (IndexedDB).
                We have no database, and our server keeps no one&apos;s list.
              </li>
              <li>
                Your browser also keeps a few settings: the name, email and
                avatar link of the last Google account that signed in (so it can
                be shown offline; no credentials), and when you last exported a
                backup.
              </li>
              <li>
                Clearing this site&apos;s data in your browser deletes all of
                the above.
              </li>
            </List>
          </Section>

          <Section title="If you sign in with Google">
            <p>
              Signing in is optional. When you do, MediaLog asks Google for:
            </p>
            <List>
              <li>
                <strong>Basic profile</strong> (name, email, profile picture),
                to show who is signed in and to keep sync records per account.
              </li>
              <li>
                <strong>The Google Drive drive.file scope</strong>, which
                reaches only the files MediaLog itself creates in your Drive,
                never your other files. MediaLog creates a MediaLog folder
                holding four region JSON files and a daily snapshot, and uses it
                to sync your devices.
              </li>
            </List>
            <p>
              Syncing happens directly between your browser and Google Drive.
              Your list never passes through our server, and our server never
              reads anything in your Drive.
            </p>
          </Section>

          <Section title="Sign-in credentials">
            <List>
              <li>
                The tokens Google issues to MediaLog are kept in an encrypted
                cookie in your browser that page scripts cannot read (httpOnly).
                When needed, our server uses it to get a short-lived (about one
                hour) access token from Google for your browser to call Drive
                with. The server stores no tokens of its own.
              </li>
              <li>
                Signing out deletes that cookie. You can also revoke
                MediaLog&apos;s access at any time on your{" "}
                <Ext href={PERMISSIONS}>Google Account permissions page</Ext>.
              </li>
            </List>
          </Section>

          <Section title="Google user data">
            <p>
              MediaLog&apos;s use and transfer to any other app of information
              received from Google APIs will adhere to the{" "}
              <Ext href={GOOGLE_POLICY}>
                Google API Services User Data Policy
              </Ext>
              , including the Limited Use requirements. That data is used only
              to sign you in and sync your list: it is never sold, used for
              advertising, transferred to anyone else, or read by people.
            </p>
          </Section>

          <Section title="Cookies and analytics">
            {analytics ? (
              <>
                <p>
                  Sign-in uses the cookies it needs (the session, and protection
                  against cross-site request forgery). The site also uses Google
                  Analytics to count visits. It sets its own cookies (named
                  _ga…) and records which pages you view, your browser and
                  device type, and your approximate location (inferred from your
                  IP address), so we can see how the site is used.
                </p>
                <List>
                  <li>
                    Your list, your Google account details and your Drive data
                    are never sent to Google Analytics.
                  </li>
                  <li>There are no ads, and this data is not used for ads.</li>
                  <li>
                    To opt out, use your browser&apos;s tracking protection or a
                    content blocker, or install the{" "}
                    <Ext href={GA_OPTOUT}>Google Analytics opt-out add-on</Ext>;
                    the site works the same. See{" "}
                    <Ext href={GA_PRIVACY}>how Google uses this data</Ext>.
                  </li>
                </List>
              </>
            ) : (
              <p>
                Only the cookies sign-in needs (the session, and protection
                against cross-site request forgery). No advertising or analytics
                cookies, and no third-party analytics or ad scripts.
              </p>
            )}
          </Section>

          <Section title="Third-party services">
            <List>
              <li>
                Google: sign-in, and syncing to Google Drive
                {analytics && "; Google Analytics, to count visits (above)"}.
              </li>
              <li>
                Vercel: hosting. Like any web host, it processes technical
                request data (such as IP address, URL and time) to run and
                protect the site; see{" "}
                <Ext href="https://vercel.com/legal/privacy-policy">
                  Vercel&apos;s privacy policy
                </Ext>
                .
              </li>
              <li>
                {sources[1]}: our server fetches the 发现 (Discover) data from
                them without any of your personal information. Cover images load
                directly from their image servers, which therefore see your IP
                address.
              </li>
            </List>
          </Section>

          <Section title="Children">
            <p>This site is not directed at children under 13.</p>
          </Section>

          <Section title="Deleting your data">
            <List>
              <li>
                On your device: clear this site&apos;s data in your browser.
              </li>
              <li>In Google Drive: delete the MediaLog folder.</li>
              <li>
                Access: revoke MediaLog on your{" "}
                <Ext href={PERMISSIONS}>Google Account permissions page</Ext>.
              </li>
            </List>
            <p>
              Our server holds none of your personal data, so there is nothing
              to delete there.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              If this policy changes, this page and the effective date above
              will be updated.
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
