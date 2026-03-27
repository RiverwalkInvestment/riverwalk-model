import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email.toLowerCase().trim()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null

        const user = await prisma.user.findUnique({ where: { email } })

        // Always run bcrypt.compare to prevent timing-based email enumeration
        const DUMMY = '$2b$12$invalidhashfortimingprotectionXXXXXXXXXXXXXXXXXXXXXX'
        const valid = await bcrypt.compare(credentials.password, user?.password ?? DUMMY)
        if (!user || !valid) return null

        return { id: user.id, email: user.email, name: user.name ?? '' }
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as { id: string }).id = token.id as string
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
