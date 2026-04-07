import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  real,
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
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cost: real("cost"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("messages_conversation_id_idx").on(table.conversationId),
    index("messages_created_at_idx").on(table.createdAt),
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
    amount: real("amount").notNull(), // positive = credit, negative = debit
    balance: real("balance").notNull(), // balance after transaction
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  conversations: many(conversations),
  memories: many(memories),
  creditTransactions: many(creditTransactions),
  apiKeys: many(apiKeys),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    user: one(users, {
      fields: [conversations.userId],
      references: [users.id],
    }),
    messages: many(messages),
  })
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
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

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  defaultModel: string | null;
  responseStyle: "concise" | "balanced" | "detailed";
  language: string | null;
  customInstructions: string | null;
}
