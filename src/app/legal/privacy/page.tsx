"use client";

import { useState } from "react";

export default function PrivacyPage() {
  const [lang, setLang] = useState<"zh" | "en">("zh");

  return (
    <div>
      {/* Header + Language toggle */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {lang === "zh" ? "隐私政策" : "Privacy Policy"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "zh" ? "最后更新：2026-05-30" : "Last updated: 2026-05-30"}
          </p>
        </div>
        <div className="relative flex items-center rounded-md bg-muted/50 p-0.5 w-[140px]">
          <div
            className="absolute left-0.5 top-0.5 bottom-0.5 rounded bg-background shadow-sm transition-transform duration-200 ease-in-out"
            style={{
              width: "calc((100% - 4px) / 2)",
              transform: `translateX(${lang === "en" ? "100%" : "0%"})`,
            }}
          />
          <button
            onClick={() => setLang("zh")}
            className={`relative flex-1 flex items-center justify-center rounded h-7 text-xs transition-colors duration-200 ${
              lang === "zh" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >中文</button>
          <button
            onClick={() => setLang("en")}
            className={`relative flex-1 flex items-center justify-center rounded h-7 text-xs transition-colors duration-200 ${
              lang === "en" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >English</button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground/60 italic mb-6 pb-4 border-b border-border/40">
        {lang === "zh"
          ? "中文版本为具有法律效力的版本。英文版本仅供参考。"
          : "The Chinese version is the legally binding version. This English translation is provided for reference only."}
      </p>

      {lang === "zh" ? <ZhContent /> : <EnContent />}
    </div>
  );
}

// --- Helper components ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-medium mb-2">{title}</h2>
      {children}
    </section>
  );
}

function H4({ children }: { children: React.ReactNode }) {
  return <h4 className="text-sm font-medium mt-3 mb-1.5">{children}</h4>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground leading-relaxed mb-2">{children}</p>;
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-1 mb-2">{children}</ul>;
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-sm text-muted-foreground leading-relaxed pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-muted-foreground/40">
      {children}
    </li>
  );
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
      {children}
    </a>
  );
}

// --- Content ---

function ZhContent() {
  return (
    <div className="space-y-6">
      <Section title="概述">
        <P>z1.chat 由{" "}<A href="https://zigao.wang">王子高 (Zigao Wang)</A>（以下简称"我们"）运营，是一个基于多模型的 AI 对话服务平台。我们重视您的隐私，本政策说明我们如何收集、使用和保护您的个人信息。</P>
        <P>使用 z1.chat 即表示您同意本隐私政策。如您不同意，请停止使用本服务。</P>
      </Section>

      <Section title="1. 我们收集的信息">
        <H4>账户信息</H4>
        <P>当您注册时，我们收集：</P>
        <Ul>
          <Li>电子邮箱地址</Li>
          <Li>您设置的显示名称</Li>
          <Li>密码的加密哈希值（我们无法查看您的原始密码）</Li>
        </Ul>
        <H4>对话内容</H4>
        <Ul>
          <Li>您发送的消息和 AI 的回复（我们不会查看您的对话内容）</Li>
          <Li>您上传的文件（仅在处理期间临时存储，1 小时内自动删除）</Li>
          <Li>AI 从对话中提取的记忆信息（用于个性化服务）</Li>
        </Ul>
        <H4>使用数据</H4>
        <Ul>
          <Li>您使用的 AI 模型和消耗的 token 数量</Li>
          <Li>每次请求的费用记录</Li>
          <Li>功能使用情况（如网络搜索、代码执行等）</Li>
        </Ul>
        <H4>技术数据</H4>
        <Ul>
          <Li>用于身份验证的会话 Cookie</Li>
          <Li>我们不使用任何追踪 Cookie、分析 Cookie 或广告 Cookie</Li>
        </Ul>
      </Section>

      <Section title="2. 我们如何使用您的信息">
        <P>我们将您的信息用于以下目的：</P>
        <Ul>
          <Li>提供和维护 z1.chat 服务</Li>
          <Li>处理您的对话请求并生成 AI 回复</Li>
          <Li>通过记忆系统提供个性化体验</Li>
          <Li>计算和记录使用费用</Li>
          <Li>发送必要的服务通知（如密码重置邮件）</Li>
          <Li>改进和优化服务质量</Li>
        </Ul>
        <P><strong>我们绝不会将您的个人信息出售给任何第三方。</strong></P>
      </Section>
      <Section title="3. 信息共享">
        <P>为提供 AI 对话服务，您的消息内容会被发送至以下第三方服务商进行处理：</P>
        <Ul>
          <Li><strong>OpenRouter</strong>（AI 模型网关）：负责将您的消息转发至相应的 AI 模型提供商（如 Anthropic、OpenAI、Google、xAI、Moonshot 等）。隐私政策：<A href="https://openrouter.ai/privacy">openrouter.ai/privacy</A></Li>
          <Li><strong>Tavily</strong>（网络搜索）：当 AI 判断需要搜索最新信息时使用。仅搜索查询词会被发送，不包含您的个人信息。隐私政策：<A href="https://www.tavily.com/privacy">tavily.com/privacy</A></Li>
          <Li><strong>E2B</strong>（代码执行沙盒）：当 AI 需要运行代码时，代码会在 E2B 的沙盒环境中执行。隐私政策：<A href="https://e2b.dev/privacy">e2b.dev/privacy</A></Li>
          <Li><strong>Mailtrap</strong>（邮件服务）：仅用于发送密码重置等服务性邮件。隐私政策：<A href="https://mailtrap.io/privacy/">mailtrap.io/privacy</A></Li>
          <Li><strong>Z-Pay</strong>（支付服务）：处理充值付款。我们不存储您的支付宝账户或银行卡信息，所有支付信息由 Z-Pay 及支付宝/微信支付处理。服务协议：<A href="https://z-pay.cn/news_8.html">z-pay.cn/news_8.html</A></Li>
        </Ul>
        <P>我们不控制上述第三方服务商对数据的处理方式。建议您查阅各服务商的隐私政策。</P>
      </Section>

      <Section title="4. 记忆系统">
        <P>z1.chat 会自动从您的对话中提取有用的信息（如您的姓名、工作、偏好等），以便在未来的对话中提供更好的个性化体验。</P>
        <P>关于记忆系统，您拥有完全控制权：</P>
        <Ul>
          <Li>您可以在设置页面查看所有已保存的记忆</Li>
          <Li>您可以编辑或删除任何单条记忆</Li>
          <Li>您可以一键清除所有记忆</Li>
        </Ul>
      </Section>

      <Section title="5. 数据存储与安全">
        <Ul>
          <Li>您的数据存储在我们的服务器上</Li>
          <Li>密码使用 bcrypt 加密存储</Li>
          <Li>会话使用 JWE 加密</Li>
          <Li>上传的文件在处理后 1 小时内自动删除</Li>
          <Li>我们采取合理的技术措施保护您的数据安全，但无法保证绝对安全</Li>
        </Ul>
      </Section>

      <Section title="6. 数据保留与删除">
        <Ul>
          <Li>您的对话和记忆将持续保存，直至您主动删除</Li>
          <Li>您可以随时删除单个对话或所有对话</Li>
          <Li>如需删除账户及全部数据，请发送邮件至 a@zigao.wang</Li>
        </Ul>
      </Section>

      <Section title="7. 儿童隐私">
        <P>z1.chat 不面向 13 岁以下的儿童。我们不会故意收集 13 岁以下儿童的个人信息。如果我们发现已收集了此类信息，将立即删除。</P>
      </Section>

      <Section title="8. Cookie 使用">
        <P>我们仅使用必要的会话 Cookie 来维持您的登录状态。我们不使用任何追踪、分析或广告 Cookie。</P>
      </Section>

      <Section title="9. 政策变更">
        <P>我们可能会不定期更新本隐私政策。重大变更将通过电子邮件通知您。继续使用服务即表示您接受更新后的政策。</P>
      </Section>

      <Section title="10. 联系我们">
        <P>如对本隐私政策有任何疑问，请联系：a@zigao.wang</P>
      </Section>
    </div>
  );
}

function EnContent() {
  return (
    <div className="space-y-6">
      <Section title="Overview">
        <P>z1.chat is operated by{" "}<A href="https://zigao.wang">Zigao Wang (王子高)</A>{" "}("we", "us", "our") and is a multi-model AI chat service. We value your privacy and this policy explains how we collect, use, and protect your personal information.</P>
        <P>By using z1.chat, you agree to this Privacy Policy. If you do not agree, please stop using our service.</P>
      </Section>

      <Section title="1. Information we collect">
        <H4>Account information</H4>
        <P>When you sign up, we collect your email address, display name, and an encrypted hash of your password (we cannot see your original password).</P>
        <H4>Conversation content</H4>
        <P>We store the messages you send and the AI's responses (we do not read your conversations), files you upload (which are temporarily stored during processing and automatically deleted within 1 hour). Our memory system also extracts key facts from conversations to personalize your experience.</P>
        <H4>Usage data</H4>
        <P>We record which AI models you use, token consumption, cost per request, and feature usage (web search, code execution, etc.).</P>
        <H4>Technical data</H4>
        <P>We use session cookies for authentication only. We do not use tracking cookies, analytics cookies, or advertising cookies of any kind.</P>
      </Section>

      <Section title="2. How we use your information">
        <P>We use your information to provide and maintain the z1.chat service, process your messages and generate AI responses, provide personalized experience through our memory system, calculate and record usage costs, send essential service notifications (such as password reset emails), and improve service quality.</P>
        <P><strong>We will never sell your personal information to any third party.</strong></P>
      </Section>
      <Section title="3. Information sharing">
        <P>To provide the AI chat service, your message content is sent to the following third-party providers for processing:</P>
        <Ul>
          <Li><strong>OpenRouter</strong> (AI gateway) routes your messages to the relevant AI model provider (Anthropic, OpenAI, Google, xAI, Moonshot, etc.). Privacy policy: <A href="https://openrouter.ai/privacy">openrouter.ai/privacy</A></Li>
          <Li><strong>Tavily</strong> (web search) is used when the AI determines it needs to search for current information. Only search queries are sent, not your personal information. Privacy policy: <A href="https://www.tavily.com/privacy">tavily.com/privacy</A></Li>
          <Li><strong>E2B</strong> (code sandbox) executes code when the AI needs to run code. Privacy policy: <A href="https://e2b.dev/privacy">e2b.dev/privacy</A></Li>
          <Li><strong>Mailtrap</strong> (email) is used only for service emails such as password resets. Privacy policy: <A href="https://mailtrap.io/privacy/">mailtrap.io/privacy</A></Li>
          <Li><strong>Z-Pay</strong> (payments) processes top-up payments. We do not store your Alipay account or bank card information. All payment data is handled by Z-Pay and Alipay/WeChat Pay. Service agreement: <A href="https://z-pay.cn/news_8.html">z-pay.cn/news_8.html</A></Li>
        </Ul>
        <P>We do not control how these third-party providers handle data. We recommend reviewing their respective privacy policies.</P>
      </Section>

      <Section title="4. Memory system">
        <P>z1.chat automatically extracts useful information from your conversations (such as your name, work, preferences) to provide a better personalized experience in future conversations. You have full control over your memories: you can view, edit, or delete any individual memory, and you can clear all memories at once from the settings page.</P>
      </Section>

      <Section title="5. Data storage and security">
        <Ul>
          <Li>Your data is stored on our servers</Li>
          <Li>Passwords are encrypted with bcrypt</Li>
          <Li>Sessions are encrypted with JWE</Li>
          <Li>Uploaded files are automatically deleted within 1 hour after processing</Li>
          <Li>We take reasonable technical measures to protect your data, but cannot guarantee absolute security</Li>
        </Ul>
      </Section>

      <Section title="6. Data retention and deletion">
        <Ul>
          <Li>Your conversations and memories are retained until you delete them</Li>
          <Li>You can delete individual conversations or all conversations at any time</Li>
          <Li>To delete your account and all associated data, email a@zigao.wang</Li>
        </Ul>
      </Section>

      <Section title="7. Children's privacy">
        <P>z1.chat is not intended for children under 13. We do not knowingly collect personal information from children under 13. If we discover we have collected such information, we will delete it immediately.</P>
      </Section>

      <Section title="8. Cookies">
        <P>We use only essential session cookies to maintain your login state. We do not use any tracking, analytics, or advertising cookies.</P>
      </Section>

      <Section title="9. Changes to this policy">
        <P>We may update this Privacy Policy from time to time. Material changes will be communicated to you via email. Continued use of the service constitutes acceptance of the updated policy.</P>
      </Section>

      <Section title="10. Contact us">
        <P>For questions about this Privacy Policy, please contact: a@zigao.wang</P>
      </Section>
    </div>
  );
}