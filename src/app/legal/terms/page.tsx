"use client";

import { useState } from "react";

export default function TermsPage() {
  const [lang, setLang] = useState<"zh" | "en">("zh");

  return (
    <div>
      {/* Header + Language toggle */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {lang === "zh" ? "服务条款" : "Terms of Service"}
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
        <P>欢迎使用 z1.chat。本服务由{" "}
          <A href="https://zigao.wang">王子高 (Zigao Wang)</A>
          （以下简称"我们"）以个人开发者身份运营。使用本服务前，请仔细阅读以下条款。注册账户或使用 z1.chat 即表示您同意遵守本服务条款。</P>
      </Section>
      <Section title="1. 服务说明">
        <P>z1.chat 是一个 AI 对话平台，通过 OpenRouter 接入多个第三方 AI 模型（包括但不限于 Claude、GPT、Gemini、Grok、Kimi、DeepSeek 等），为用户提供 AI 对话服务。</P>
        <P>本服务采用按量付费模式。用户充值后，根据实际使用的 AI 模型和 token 消耗量扣费。</P>
      </Section>

      <Section title="2. 账户">
        <H4>注册要求</H4>
        <Ul>
          <Li>您必须年满 13 周岁方可使用本服务</Li>
          <Li>您需提供真实有效的电子邮箱地址</Li>
          <Li>每人仅限注册一个账户</Li>
          <Li>您有责任保管好您的账户登录信息</Li>
        </Ul>
        <H4>账户安全</H4>
        <P>如果您发现账户存在未经授权的使用，请立即联系我们：a@zigao.wang</P>
      </Section>

      <Section title="3. 充值与计费">
        <H4>充值</H4>
        <Ul>
          <Li>通过 Z-Pay 支持支付宝和微信支付充值</Li>
          <Li>充值金额以人民币（¥）计价</Li>
          <Li>充值成功后，额度立即到账</Li>
        </Ul>
        <H4>计费方式</H4>
        <Ul>
          <Li>每次 AI 对话请求根据所使用的模型和消耗的 token 数量计费</Li>
          <Li>后台任务（包括记忆提取、对话摘要、标题生成等）也会产生少量费用</Li>
          <Li>网络搜索和代码执行按次计费</Li>
          <Li>所有费用在请求完成后从您的余额中扣除</Li>
          <Li>具体定价以使用时系统显示为准</Li>
        </Ul>
        <H4>余额用尽</H4>
        <Ul>
          <Li>当余额为零时，您仍可使用免费模型继续对话</Li>
          <Li>付费模型和部分高级功能（如代码执行）将暂时不可用</Li>
          <Li>您的对话历史、记忆和设置不受影响</Li>
        </Ul>
        <H4>退款政策</H4>
        <Ul>
          <Li>已充值的余额一般不予退款</Li>
          <Li>因服务故障导致的异常扣费，可联系我们处理</Li>
          <Li>如因特殊原因需要退款，请联系 a@zigao.wang</Li>
        </Ul>
      </Section>

      <Section title="4. 使用规范">
        <P>使用 z1.chat 时，您同意不进行以下行为：</P>
        <Ul>
          <Li>利用本服务从事任何违反中华人民共和国法律法规的活动</Li>
          <Li>生成、传播违法、暴力、色情、仇恨或其他有害内容</Li>
          <Li>尝试攻击、干扰或破坏本服务的正常运行</Li>
          <Li>通过自动化手段（如脚本、机器人）大量访问服务</Li>
          <Li>转售或转让您的账户或服务访问权</Li>
          <Li>利用本服务进行欺诈或其他侵害他人权益的行为</Li>
          <Li>试图绕过服务的安全措施或访问限制</Li>
        </Ul>
        <P>违反上述规定的，我们有权暂停或终止您的账户，且不予退还账户余额。</P>
      </Section>
      <Section title="5. AI 输出声明">
        <P><strong>重要提示：AI 生成的内容可能不准确、不完整或具有误导性。</strong></P>
        <Ul>
          <Li>z1.chat 提供的 AI 回复由第三方模型生成，我们不对其准确性、可靠性或适用性作任何保证</Li>
          <Li>请勿将 AI 输出作为医疗、法律、财务或其他专业决策的唯一依据</Li>
          <Li>您有责任核实 AI 提供的重要信息</Li>
          <Li>因依赖 AI 输出做出的任何决定，由您自行承担风险和责任</Li>
        </Ul>
      </Section>

      <Section title="6. 知识产权">
        <Ul>
          <Li>您保留您输入内容的所有权利</Li>
          <Li>AI 生成的输出内容的知识产权归属以相关法律规定为准</Li>
          <Li>z1.chat 的品牌、界面设计和代码归我们所有</Li>
          <Li>我们不对您的输入内容主张所有权</Li>
        </Ul>
      </Section>

      <Section title="7. 服务可用性">
        <Ul>
          <Li>我们努力保持服务的持续可用，但不做正常运行时间的保证</Li>
          <Li>服务可能因维护、升级、第三方服务故障或不可抗力而中断</Li>
          <Li>对于因服务中断造成的损失，我们不承担责任</Li>
        </Ul>
      </Section>

      <Section title="8. 第三方服务">
        <P>z1.chat 依赖多个第三方服务运行，包括但不限于 OpenRouter、各 AI 模型提供商、Tavily、E2B 和 Z-Pay。这些服务的可用性和政策不在我们的控制范围内。建议您了解相关服务的条款和政策。</P>
      </Section>

      <Section title="9. 责任限制">
        <P>在适用法律允许的最大范围内：</P>
        <Ul>
          <Li>本服务按"原样"提供，不附带任何明示或暗示的保证</Li>
          <Li>对于因使用或无法使用本服务而导致的任何直接、间接、附带、特殊或后果性损害，我们不承担责任</Li>
          <Li>我们的最大赔偿责任不超过您在过去 12 个月内向我们支付的总金额</Li>
        </Ul>
      </Section>

      <Section title="10. 账户终止">
        <H4>我们可能终止您的账户，如果：</H4>
        <Ul>
          <Li>您违反了本服务条款</Li>
          <Li>您的账户被用于非法活动</Li>
          <Li>为遵守法律要求</Li>
        </Ul>
        <H4>您可以随时注销账户：</H4>
        <Ul>
          <Li>发送邮件至 a@zigao.wang 请求注销</Li>
          <Li>注销后，您的所有数据将被删除</Li>
          <Li>账户余额在注销后不予退还</Li>
        </Ul>
      </Section>

      <Section title="11. 条款变更">
        <P>我们可能会不定期修改本服务条款。重大变更将通过电子邮件或服务内通知提前告知。变更生效后继续使用服务即表示您接受新的条款。</P>
      </Section>

      <Section title="12. 适用法律">
        <P>本服务条款适用中华人民共和国法律。因本条款引起的争议，应协商解决；协商不成的，提交有管辖权的人民法院诉讼解决。</P>
      </Section>

      <Section title="13. 联系方式">
        <P>如对本服务条款有任何疑问，请联系：a@zigao.wang</P>
      </Section>
    </div>
  );
}

function EnContent() {
  return (
    <div className="space-y-6">
      <Section title="Overview">
        <P>Welcome to z1.chat. This service is operated by{" "}
          <A href="https://zigao.wang">Zigao Wang (王子高)</A>
          {" "}("we", "us", "our") as an independent developer. Please read these terms carefully before using z1.chat. By creating an account or using the service, you agree to these Terms of Service.</P>
      </Section>

      <Section title="1. Service description">
        <P>z1.chat is an AI chat platform that connects to multiple third-party AI models (including but not limited to Claude, GPT, Gemini, Grok, Kimi, DeepSeek) through OpenRouter to provide AI conversation services. The service uses a pay-as-you-go pricing model. Users top up their balance and are charged based on the AI model used and tokens consumed.</P>
      </Section>

      <Section title="2. Accounts">
        <P>You must be at least 13 years old to use this service. You must provide a valid email address, are limited to one account per person, and are responsible for keeping your login credentials secure. If you discover unauthorized use of your account, contact us immediately at a@zigao.wang.</P>
      </Section>

      <Section title="3. Credits and billing">
        <P>Top-ups are processed through Z-Pay via Alipay and WeChat Pay, priced in RMB (¥), and credited immediately upon successful payment. Each AI request is billed based on the model used and tokens consumed. Background tasks (memory extraction, conversation summaries, title generation) also incur small costs. Web search and code execution are billed per use. All costs are deducted from your balance after each request.</P>
        <P>When your balance reaches zero, you can still chat using free models. Paid models and certain features (such as code execution) will be temporarily unavailable. Your conversation history, memories, and settings remain intact.</P>
        <P>Credits are generally non-refundable. Erroneous charges caused by service issues will be addressed on a case-by-case basis. For special refund requests, contact a@zigao.wang.</P>
      </Section>
      <Section title="4. Acceptable use">
        <P>When using z1.chat, you agree not to engage in any activity that violates applicable laws, generate or distribute illegal, violent, pornographic, hateful, or otherwise harmful content, attempt to attack, interfere with, or disrupt the service, access the service through automated means (scripts, bots) at scale, resell or transfer your account or access, engage in fraud or activities that harm others, or attempt to bypass security measures or access restrictions.</P>
        <P>Violation of these rules may result in suspension or termination of your account without refund of remaining balance.</P>
      </Section>

      <Section title="5. AI output disclaimer">
        <P><strong>AI-generated content may be inaccurate, incomplete, or misleading.</strong></P>
        <P>AI responses on z1.chat are generated by third-party models, and we make no guarantees about their accuracy, reliability, or suitability. Do not rely on AI output as the sole basis for medical, legal, financial, or other professional decisions. You are responsible for verifying important information provided by the AI. Any decisions made based on AI output are at your own risk.</P>
      </Section>

      <Section title="6. Intellectual property">
        <P>You retain all rights to your input content. Intellectual property rights of AI-generated output are subject to applicable law. The z1.chat brand, interface design, and code belong to us. We do not claim ownership of your input content.</P>
      </Section>

      <Section title="7. Service availability">
        <P>We strive to maintain continuous service availability but make no uptime guarantees. The service may be interrupted due to maintenance, upgrades, third-party service failures, or force majeure. We are not liable for losses caused by service interruptions.</P>
      </Section>

      <Section title="8. Third-party services">
        <P>z1.chat relies on multiple third-party services including OpenRouter, various AI model providers, Tavily, E2B, and Z-Pay. The availability and policies of these services are outside our control.</P>
      </Section>

      <Section title="9. Limitation of liability">
        <P>To the maximum extent permitted by applicable law, this service is provided "as is" without any express or implied warranties. We are not liable for any direct, indirect, incidental, special, or consequential damages arising from the use or inability to use this service. Our maximum liability shall not exceed the total amount you have paid to us in the preceding 12 months.</P>
      </Section>

      <Section title="10. Account termination">
        <P>We may terminate your account if you violate these Terms, your account is used for illegal activity, or to comply with legal requirements. You may request account deletion at any time by emailing a@zigao.wang. Upon deletion, all your data will be removed. Account balance is non-refundable after deletion.</P>
      </Section>

      <Section title="11. Changes to terms">
        <P>We may modify these Terms from time to time. Material changes will be communicated via email or in-app notification. Continued use of the service after changes take effect constitutes acceptance of the new terms.</P>
      </Section>

      <Section title="12. Governing law">
        <P>These Terms are governed by the laws of the People's Republic of China. Disputes arising from these Terms shall be resolved through negotiation, or if negotiation fails, by litigation in a court of competent jurisdiction.</P>
      </Section>

      <Section title="13. Contact">
        <P>For questions about these Terms, please contact: a@zigao.wang</P>
      </Section>
    </div>
  );
}