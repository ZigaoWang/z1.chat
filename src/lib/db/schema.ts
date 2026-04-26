import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  real,
  numeric,
  jsonb,
  index,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const messageRoleEnum = pgEnum("message_role", [
  "system",
  "user",
  "assistant",
  "tool",
]);

export const memoryCategoryEnum = pgEnum("memory_category", [
  "personal",
  "preferences",
  "projects",
  "style",
  "facts",
]);

// Users
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  passwordHash: text("password_hash"),
  emailVerified: boolean("email_verified").notNull().default(false),
  role: text("role").notNull().default("user"), // "user" | "admin"
  creditBalance: numeric("credit_balance", { precision: 20, scale: 10 }).notNull().default("0"),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  onboardingState: jsonb("onboarding_state").$type<OnboardingState>().default({}),
  preferences: jsonb("preferences").$type<UserPreferences>().default({
    theme: "system",
    defaultModel: null,
    responseStyle: "balanced",
    language: null,
    customInstructions: null,
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Conversations
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title"),
    model: text("model"),
    summary: text("summary"),
    summaryMessageCount: integer("summary_message_count").default(0),
    compactionSummary: text("compaction_summary"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("conversations_user_id_idx").on(table.userId),
    index("conversations_updated_at_idx").on(table.updatedAt),
  ]
);

// Messages
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    model: text("model"),
    parentId: uuid("parent_id"),
    branchIndex: integer("branch_index").notNull().default(0),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cost: numeric("cost", { precision: 20, scale: 10 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("messages_conversation_id_idx").on(table.conversationId),
    index("messages_created_at_idx").on(table.createdAt),
    index("messages_parent_id_idx").on(table.parentId),
  ]
);

// Memories
export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: memoryCategoryEnum("category").notNull(),
    content: text("content").notNull(),
    sourceConversationId: uuid("source_conversation_id").references(
      () => conversations.id,
      { onDelete: "set null" }
    ),
    relevanceScore: real("relevance_score").default(0.5),
    accessCount: integer("access_count").default(0),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("memories_user_id_idx").on(table.userId),
    index("memories_category_idx").on(table.category),
  ]
);

// Credits
export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 20, scale: 10 }).notNull(), // positive = credit, negative = debit
    balance: numeric("balance", { precision: 20, scale: 10 }).notNull(), // balance after transaction
    type: text("type").notNull(), // 'purchase', 'usage', 'refund'
    description: text("description"),
    messageId: uuid("message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    stripePaymentId: text("stripe_payment_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("credit_transactions_user_id_idx").on(table.userId),
  ]
);

// Sessions
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
);

// Password Reset Tokens
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    used: boolean("used").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("password_reset_tokens_user_id_idx").on(table.userId)]
);

// Email Verification Codes
export const emailVerificationCodes = pgTable(
  "email_verification_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    used: boolean("used").notNull().default(false),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("email_verification_codes_user_id_idx").on(table.userId)]
);

// Usage Logs
export const usageLogs = pgTable(
  "usage_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(
      () => conversations.id,
      { onDelete: "set null" }
    ),
    type: text("type").notNull(), // 'chat', 'title', 'summary', 'memory_extraction', 'memory_dedup', 'consolidation', 'immediate_memory', 'compaction', 'search', 'code_execute'
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 20, scale: 10 }).notNull().default("0"),
    userCostUsd: numeric("user_cost_usd", { precision: 20, scale: 10 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("usage_logs_user_id_idx").on(table.userId),
    index("usage_logs_created_at_idx").on(table.createdAt),
    index("usage_logs_type_idx").on(table.type),
  ]
);

// Invite Tokens
export const inviteTokens = pgTable(
  "invite_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull().unique(),
    creditAmount: numeric("credit_amount", { precision: 20, scale: 10 }).notNull(),
    used: boolean("used").notNull().default(false),
    usedByUserId: uuid("used_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("invite_tokens_token_idx").on(table.token)]
);

// Payment Orders
export const paymentOrders = pgTable(
  "payment_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    outTradeNo: text("out_trade_no").notNull().unique(),
    tradeNo: text("trade_no"), // ZPay internal order number
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(), // CNY
    creditAmount: numeric("credit_amount", { precision: 20, scale: 10 }).notNull(), // USD credits to add
    status: text("status").notNull().default("pending"), // pending, paid, failed
    type: text("type").notNull().default("alipay"), // alipay, wxpay
    name: text("name").notNull(), // product name
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("payment_orders_user_id_idx").on(table.userId),
    index("payment_orders_out_trade_no_idx").on(table.outTradeNo),
    index("payment_orders_status_idx").on(table.status),
  ]
);

// API Keys (BYOK)
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  encryptedKey: text("encrypted_key").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Artifacts
export const artifacts = pgTable(
  "artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'document' | 'code' | 'html' | 'svg' | 'mermaid'
    title: text("title").notNull(),
    content: text("content").notNull(),
    language: text("language"), // for code: 'python', 'typescript', etc.
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("artifacts_conversation_id_idx").on(table.conversationId),
    index("artifacts_user_id_idx").on(table.userId),
  ]
);

// Artifact Versions (for undo)
export const artifactVersions = pgTable(
  "artifact_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artifactId: uuid("artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("artifact_versions_artifact_id_idx").on(table.artifactId),
  ]
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  conversations: many(conversations),
  memories: many(memories),
  creditTransactions: many(creditTransactions),
  apiKeys: many(apiKeys),
  sessions: many(sessions),
  usageLogs: many(usageLogs),
  artifacts: many(artifacts),
  paymentOrders: many(paymentOrders),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    user: one(users, {
      fields: [conversations.userId],
      references: [users.id],
    }),
    messages: many(messages),
    artifacts: many(artifacts),
  })
);

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  parent: one(messages, {
    fields: [messages.parentId],
    references: [messages.id],
    relationName: "messageTree",
  }),
  children: many(messages, { relationName: "messageTree" }),
}));

export const memoriesRelations = relations(memories, ({ one }) => ({
  user: one(users, {
    fields: [memories.userId],
    references: [users.id],
  }),
  sourceConversation: one(conversations, {
    fields: [memories.sourceConversationId],
    references: [conversations.id],
  }),
}));

export const creditTransactionsRelations = relations(
  creditTransactions,
  ({ one }) => ({
    user: one(users, {
      fields: [creditTransactions.userId],
      references: [users.id],
    }),
    message: one(messages, {
      fields: [creditTransactions.messageId],
      references: [messages.id],
    }),
  })
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const inviteTokensRelations = relations(inviteTokens, ({ one }) => ({
  usedByUser: one(users, {
    fields: [inviteTokens.usedByUserId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [inviteTokens.createdBy],
    references: [users.id],
  }),
}));

export const usageLogsRelations = relations(usageLogs, ({ one }) => ({
  user: one(users, {
    fields: [usageLogs.userId],
    references: [users.id],
  }),
  conversation: one(conversations, {
    fields: [usageLogs.conversationId],
    references: [conversations.id],
  }),
}));

export const artifactsRelations = relations(artifacts, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [artifacts.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [artifacts.userId],
    references: [users.id],
  }),
  versions: many(artifactVersions),
}));

export const artifactVersionsRelations = relations(artifactVersions, ({ one }) => ({
  artifact: one(artifacts, {
    fields: [artifactVersions.artifactId],
    references: [artifacts.id],
  }),
}));

export const paymentOrdersRelations = relations(paymentOrders, ({ one }) => ({
  user: one(users, {
    fields: [paymentOrders.userId],
    references: [users.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type UsageLog = typeof usageLogs.$inferSelect;
export type InviteToken = typeof inviteTokens.$inferSelect;
export type Artifact = typeof artifacts.$inferSelect;
export type ArtifactVersion = typeof artifactVersions.$inferSelect;
export type PaymentOrder = typeof paymentOrders.$inferSelect;
export type EmailVerificationCode = typeof emailVerificationCodes.$inferSelect;

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  defaultModel: string | null;
  responseStyle: "concise" | "balanced" | "detailed";
  language: string | null;
  customInstructions: string | null;
}

export interface OnboardingState {
  modelSelectorTooltipSeen?: boolean;
  sidebarTooltipSeen?: boolean;
  firstMessageSent?: boolean;
}
