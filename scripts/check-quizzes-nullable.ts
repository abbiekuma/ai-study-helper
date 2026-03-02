/**
 * One-off: check if quizzes.conversation_id allows NULL; if not, run ALTER.
 * Run: npx tsx scripts/check-quizzes-nullable.ts
 */
import { config } from 'dotenv'
import { Client } from 'pg'

config({ path: ['.env.local', '.env'] })

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const client = new Client({ connectionString: url })

async function main() {
  await client.connect()
  try {
    const res = await client.query(
      `SELECT column_name, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'quizzes'
         AND column_name = 'conversation_id'`,
    )
    if (res.rows.length === 0) {
      console.log('quizzes.conversation_id column not found')
      return
    }
    const { is_nullable } = res.rows[0]
    if (is_nullable === 'YES') {
      console.log('OK: quizzes.conversation_id already allows NULL')
      return
    }
    console.log('quizzes.conversation_id is NOT NULL, applying ALTER...')
    await client.query(
      `ALTER TABLE "quizzes" ALTER COLUMN "conversation_id" DROP NOT NULL`,
    )
    console.log('Done: quizzes.conversation_id now allows NULL')
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
