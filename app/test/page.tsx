import { createClient } from '../utils/supabase/server'
import { prisma } from '../../lib/prisma'

export default async function TestPage() {
  // Supabase接続確認
  let supabaseStatus = 'OK'
  let supabaseUser = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    supabaseUser = user
  } catch (e) {
    supabaseStatus = `Error: ${e}`
  }

  // Prisma接続確認
  let prismaStatus = 'OK'
  let userCount = 0
  try {
    userCount = await prisma.user.count()
  } catch (e) {
    prismaStatus = `Error: ${e}`
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>接続テスト</h1>

      <h2>Supabase Auth</h2>
      <p>ステータス: {supabaseStatus}</p>
      <p>ログインユーザー: {supabaseUser ? supabaseUser.email : '未ログイン'}</p>

      <h2>Prisma (DB)</h2>
      <p>ステータス: {prismaStatus}</p>
      <p>usersテーブルのレコード数: {userCount}</p>
    </div>
  )
}
